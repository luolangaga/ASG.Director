bl_info = {
    "name": "ASG Director BP Sync",
    "author": "ASG",
    "version": (0, 1, 0),
    "blender": (3, 6, 0),
    "location": "View3D > Sidebar > ASG",
    "description": "Sync ASG.Director BP picks and auto-load 5 role models from a unified folder rule.",
    "category": "Import-Export",
}

import json
import re
import urllib.request
from pathlib import Path

import bpy
from bpy.props import BoolProperty
from bpy.props import FloatProperty
from bpy.props import PointerProperty
from bpy.props import StringProperty
from bpy.types import Operator
from bpy.types import Panel
from bpy.types import Scene


SYNC_SLOT_KEYS = ("survivor_1", "survivor_2", "survivor_3", "survivor_4", "hunter")
INVALID_FS_CHARS = re.compile(r'[\\/:*?"<>|]')
EMPTY_ROLE_NAMES = {"", "暂无", "none", "null"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".tga", ".webp", ".dds", ".tif", ".tiff"}
HELPER_NAME_HINTS = ("sphere", "helper", "collision", "collider", "hitbox", "trigger", "dummy")

_SYNC_RUNNING = False
_LAST_STATUS = "未启动"
_LAST_ERROR = ""
_LAST_SLOT_NAMES = {key: "" for key in SYNC_SLOT_KEYS}
_AUTO_RENDER_WINDOW_PENDING = False


def set_status(text):
    global _LAST_STATUS
    _LAST_STATUS = text


def set_error(text):
    global _LAST_ERROR
    _LAST_ERROR = text or ""


def clear_error():
    set_error("")


def clean_role_name(name):
    if not name:
        return ""
    value = str(name).strip()
    if value.lower() in EMPTY_ROLE_NAMES:
        return ""
    return INVALID_FS_CHARS.sub("_", value)


def get_or_create_collection(scene, name):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
    if scene.collection.children.get(collection.name) is None:
        scene.collection.children.link(collection)
    return collection


def get_slot_collection(scene, slot_key):
    if slot_key == "survivor_1":
        return scene.asg_slot_survivor_1
    if slot_key == "survivor_2":
        return scene.asg_slot_survivor_2
    if slot_key == "survivor_3":
        return scene.asg_slot_survivor_3
    if slot_key == "survivor_4":
        return scene.asg_slot_survivor_4
    return scene.asg_slot_hunter


def set_slot_collection(scene, slot_key, collection):
    if slot_key == "survivor_1":
        scene.asg_slot_survivor_1 = collection
    elif slot_key == "survivor_2":
        scene.asg_slot_survivor_2 = collection
    elif slot_key == "survivor_3":
        scene.asg_slot_survivor_3 = collection
    elif slot_key == "survivor_4":
        scene.asg_slot_survivor_4 = collection
    else:
        scene.asg_slot_hunter = collection


def bind_default_slot_collections(scene):
    defaults = {
        "survivor_1": "ASG_Survivor_1",
        "survivor_2": "ASG_Survivor_2",
        "survivor_3": "ASG_Survivor_3",
        "survivor_4": "ASG_Survivor_4",
        "hunter": "ASG_Hunter",
    }
    for slot_key, collection_name in defaults.items():
        collection = get_or_create_collection(scene, collection_name)
        set_slot_collection(scene, slot_key, collection)


def fetch_bp_state(api_url):
    request = urllib.request.Request(api_url, headers={"User-Agent": "ASG-Blender-Sync/0.1"})
    with urllib.request.urlopen(request, timeout=2.5) as response:
        payload = json.loads(response.read().decode("utf-8", errors="ignore"))
        return payload


def extract_slot_names_from_payload(payload):
    state = payload.get("state", payload) if isinstance(payload, dict) else {}
    if not isinstance(state, dict):
        state = {}
    round_data = state.get("currentRoundData") if isinstance(state.get("currentRoundData"), dict) else {}

    survivors = round_data.get("selectedSurvivors")
    if not isinstance(survivors, list):
        survivors = state.get("survivors") if isinstance(state.get("survivors"), list) else []
    survivors = [clean_role_name(item) for item in survivors[:4]]
    while len(survivors) < 4:
        survivors.append("")

    hunter = clean_role_name(round_data.get("selectedHunter") or state.get("hunter") or "")

    return {
        "survivor_1": survivors[0],
        "survivor_2": survivors[1],
        "survivor_3": survivors[2],
        "survivor_4": survivors[3],
        "hunter": hunter,
    }


def resolve_model_path(scene, role_name):
    root = (scene.asg_model_root_dir or "").strip()
    if not root:
        return None
    root_path = Path(bpy.path.abspath(root))
    base_path = root_path / role_name
    if not base_path.exists() or not base_path.is_dir():
        return None

    gltf_files = sorted(
        [p for p in base_path.iterdir() if p.is_file() and p.suffix.lower() == ".gltf"],
        key=lambda p: p.name.lower()
    )
    if gltf_files:
        return gltf_files[0]
    return None


def clear_slot_imported_objects(slot_key):
    to_remove = []
    for obj in bpy.data.objects:
        if obj.get("asg_bp_sync_slot") == slot_key:
            to_remove.append(obj)
    for obj in to_remove:
        bpy.data.objects.remove(obj, do_unlink=True)


def ensure_action_loop(action):
    if action is None:
        return
    fcurves = getattr(action, "fcurves", None)
    if fcurves is None:
        return
    for fcurve in fcurves:
        modifiers = getattr(fcurve, "modifiers", None)
        if modifiers is None:
            continue
        has_cycles = any(mod.type == "CYCLES" for mod in modifiers)
        if not has_cycles:
            modifiers.new(type="CYCLES")


def apply_loop_animation(new_actions, new_objects):
    for action in new_actions:
        try:
            ensure_action_loop(action)
        except Exception:
            continue

    action_for_assign = new_actions[0] if new_actions else None
    for obj in new_objects:
        if obj.type != "ARMATURE":
            continue
        anim_data = obj.animation_data_create()
        if anim_data.action is None and action_for_assign is not None:
            anim_data.action = action_for_assign


def hide_helper_objects(new_objects):
    for obj in new_objects:
        if obj.type != "MESH":
            continue
        lower_name = obj.name.lower()
        if any(hint in lower_name for hint in HELPER_NAME_HINTS):
            obj.hide_set(True)
            obj.hide_render = True


def build_texture_lookup(root_dir):
    lookup = {}
    if not root_dir.exists() or not root_dir.is_dir():
        return lookup
    for file_path in root_dir.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in IMAGE_EXTS:
            continue
        lookup[file_path.name.lower()] = file_path
    return lookup


def relink_missing_textures(new_objects, model_dir):
    texture_lookup = build_texture_lookup(model_dir)
    if not texture_lookup:
        return

    for obj in new_objects:
        materials = getattr(obj.data, "materials", None)
        if not materials:
            continue
        for mat in materials:
            if mat is None or not mat.use_nodes or mat.node_tree is None:
                continue
            for node in mat.node_tree.nodes:
                if node.type != "TEX_IMAGE" or node.image is None:
                    continue
                image = node.image
                if image.packed_file:
                    continue
                current_path = bpy.path.abspath(image.filepath) if image.filepath else ""
                if current_path and Path(current_path).exists():
                    continue

                preferred_name = Path(current_path).name if current_path else ""
                if not preferred_name:
                    preferred_name = image.name
                hit = texture_lookup.get(preferred_name.lower())
                if not hit:
                    continue
                try:
                    image.filepath = str(hit)
                    image.reload()
                except Exception:
                    pass


def ensure_camera(scene):
    if scene.camera and scene.camera.name in bpy.data.objects:
        return scene.camera
    cam_data = bpy.data.cameras.new("ASG_Auto_Camera")
    cam_obj = bpy.data.objects.new("ASG_Auto_Camera", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, -7.0, 2.0)
    cam_obj.rotation_euler = (1.3, 0.0, 0.0)
    scene.camera = cam_obj
    return cam_obj


def _configure_latest_window_as_rendered_camera():
    global _AUTO_RENDER_WINDOW_PENDING
    wm = bpy.context.window_manager
    if len(wm.windows) < 2:
        return 0.2
    target_window = wm.windows[-1]
    area = next((a for a in target_window.screen.areas if a.type == "VIEW_3D"), None)
    if area is None and target_window.screen.areas:
        area = target_window.screen.areas[0]
        area.type = "VIEW_3D"
    if area is None:
        _AUTO_RENDER_WINDOW_PENDING = False
        return None

    region = next((r for r in area.regions if r.type == "WINDOW"), None)
    if region is None:
        _AUTO_RENDER_WINDOW_PENDING = False
        return None

    with bpy.context.temp_override(window=target_window, area=area, region=region):
        space = area.spaces.active
        space.shading.type = "RENDERED"
        space.region_3d.view_perspective = "CAMERA"
        space.overlay.show_overlays = False
        try:
            bpy.ops.view3d.view_camera()
        except Exception:
            pass

    _AUTO_RENDER_WINDOW_PENDING = False
    return None


def open_render_preview_window(context):
    global _AUTO_RENDER_WINDOW_PENDING
    ensure_camera(context.scene)
    area = context.area
    region = context.region
    if area is None or area.type != "VIEW_3D":
        return
    if region is None or region.type != "WINDOW":
        return
    with bpy.context.temp_override(window=context.window, area=area, region=region):
        bpy.ops.screen.area_dupli("INVOKE_DEFAULT")
    _AUTO_RENDER_WINDOW_PENDING = True
    bpy.app.timers.register(_configure_latest_window_as_rendered_camera, first_interval=0.2)


def import_model_into_slot(scene, slot_key, role_name, model_path):
    target_collection = get_slot_collection(scene, slot_key)
    if target_collection is None:
        bind_default_slot_collections(scene)
        target_collection = get_slot_collection(scene, slot_key)
    if target_collection is None:
        raise RuntimeError(f"槽位 {slot_key} 未绑定集合")

    before_objects = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)

    result = bpy.ops.import_scene.gltf(filepath=str(model_path))
    if "FINISHED" not in result:
        raise RuntimeError(f"导入失败: {model_path}")

    new_objects = [obj for obj in bpy.data.objects if obj not in before_objects]
    new_actions = [act for act in bpy.data.actions if act not in before_actions]

    for obj in new_objects:
        if target_collection not in obj.users_collection:
            target_collection.objects.link(obj)
        for collection in list(obj.users_collection):
            if collection != target_collection:
                collection.objects.unlink(obj)
        obj["asg_bp_sync_slot"] = slot_key
        obj["asg_bp_sync_role"] = role_name

    apply_loop_animation(new_actions, new_objects)
    relink_missing_textures(new_objects, model_path.parent)
    if scene.asg_hide_helper_meshes:
        hide_helper_objects(new_objects)


def sync_from_bp_state(scene, force_reload=False):
    payload = fetch_bp_state(scene.asg_bp_api_url)
    slots = extract_slot_names_from_payload(payload)

    for slot_key, role_name in slots.items():
        previous = _LAST_SLOT_NAMES.get(slot_key, "")

        if not role_name:
            if previous:
                clear_slot_imported_objects(slot_key)
            _LAST_SLOT_NAMES[slot_key] = ""
            continue

        if (not force_reload) and role_name == previous:
            continue

        model_path = resolve_model_path(scene, role_name)
        if model_path is None:
            raise FileNotFoundError(
                f"找不到模型: 角色={role_name}, 槽位={slot_key}, 规则={scene.asg_model_root_dir}/{role_name}/*.gltf"
            )

        clear_slot_imported_objects(slot_key)
        import_model_into_slot(scene, slot_key, role_name, model_path)
        _LAST_SLOT_NAMES[slot_key] = role_name


def sync_timer():
    if not _SYNC_RUNNING:
        return None

    scene = bpy.context.scene
    if scene is None:
        return 1.0

    interval = max(0.2, float(scene.asg_poll_interval))
    try:
        sync_from_bp_state(scene, force_reload=False)
        set_status("同步中")
        clear_error()
    except Exception as exc:
        set_status("同步异常")
        set_error(str(exc))

    return interval


class ASG_OT_bind_default_slots(Operator):
    bl_idname = "asg_bp.bind_default_slots"
    bl_label = "绑定默认五槽位"
    bl_description = "自动创建并绑定 求生者1~4 + 监管者 5个集合"

    def execute(self, context):
        bind_default_slot_collections(context.scene)
        self.report({"INFO"}, "已绑定默认五个槽位集合")
        return {"FINISHED"}


class ASG_OT_sync_now(Operator):
    bl_idname = "asg_bp.sync_now"
    bl_label = "立即同步"
    bl_description = "立刻读取 BP 状态并导入模型"

    force_reload: BoolProperty(
        name="强制重载",
        default=False,
        description="即使角色名未变化，也重新加载对应模型",
    )

    def execute(self, context):
        scene = context.scene
        try:
            sync_from_bp_state(scene, force_reload=self.force_reload)
            set_status("同步成功")
            clear_error()
            self.report({"INFO"}, "同步完成")
            return {"FINISHED"}
        except Exception as exc:
            set_status("同步失败")
            set_error(str(exc))
            self.report({"ERROR"}, f"同步失败: {exc}")
            return {"CANCELLED"}


class ASG_OT_start_sync(Operator):
    bl_idname = "asg_bp.start_sync"
    bl_label = "启动同步"
    bl_description = "启动定时同步 BP 状态"

    def execute(self, context):
        global _SYNC_RUNNING
        _SYNC_RUNNING = True
        bind_default_slot_collections(context.scene)
        if not bpy.app.timers.is_registered(sync_timer):
            bpy.app.timers.register(sync_timer, first_interval=0.2, persistent=True)
        if context.scene.asg_auto_open_render_window and not _AUTO_RENDER_WINDOW_PENDING:
            open_render_preview_window(context)
        set_status("同步中")
        clear_error()
        self.report({"INFO"}, "已启动 BP 同步")
        return {"FINISHED"}


class ASG_OT_stop_sync(Operator):
    bl_idname = "asg_bp.stop_sync"
    bl_label = "停止同步"
    bl_description = "停止定时同步"

    def execute(self, _context):
        global _SYNC_RUNNING
        _SYNC_RUNNING = False
        if bpy.app.timers.is_registered(sync_timer):
            bpy.app.timers.unregister(sync_timer)
        set_status("已停止")
        self.report({"INFO"}, "已停止 BP 同步")
        return {"FINISHED"}


class ASG_PT_panel(Panel):
    bl_label = "ASG Director BP Sync"
    bl_idname = "ASG_PT_director_bp_sync"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "ASG"

    def draw(self, context):
        scene = context.scene
        layout = self.layout

        layout.prop(scene, "asg_bp_api_url", text="BP API")
        layout.prop(scene, "asg_model_root_dir", text="模型根目录")
        layout.prop(scene, "asg_poll_interval", text="轮询间隔(秒)")
        layout.prop(scene, "asg_auto_open_render_window", text="启动同步时自动打开渲染窗口")
        layout.prop(scene, "asg_hide_helper_meshes", text="自动隐藏辅助球体/碰撞体")

        row = layout.row(align=True)
        row.operator("asg_bp.bind_default_slots", icon="OUTLINER_COLLECTION")
        row.operator("asg_bp.sync_now", icon="FILE_REFRESH")

        row = layout.row(align=True)
        row.operator("asg_bp.start_sync", icon="PLAY")
        row.operator("asg_bp.stop_sync", icon="PAUSE")

        box = layout.box()
        box.label(text="五个槽位绑定")
        box.prop(scene, "asg_slot_survivor_1", text="求生者1")
        box.prop(scene, "asg_slot_survivor_2", text="求生者2")
        box.prop(scene, "asg_slot_survivor_3", text="求生者3")
        box.prop(scene, "asg_slot_survivor_4", text="求生者4")
        box.prop(scene, "asg_slot_hunter", text="监管者")

        box = layout.box()
        box.label(text=f"状态: {_LAST_STATUS}")
        if _LAST_ERROR:
            box.label(text=f"错误: {_LAST_ERROR}", icon="ERROR")


classes = (
    ASG_OT_bind_default_slots,
    ASG_OT_sync_now,
    ASG_OT_start_sync,
    ASG_OT_stop_sync,
    ASG_PT_panel,
)


def register():
    for cls in classes:
        bpy.utils.register_class(cls)

    Scene.asg_bp_api_url = StringProperty(
        name="BP API URL",
        default="http://127.0.0.1:9528/api/current-state",
    )
    Scene.asg_model_root_dir = StringProperty(
        name="模型根目录",
        subtype="DIR_PATH",
        default="",
    )
    Scene.asg_poll_interval = FloatProperty(
        name="轮询间隔",
        default=0.8,
        min=0.2,
        max=10.0,
    )
    Scene.asg_auto_open_render_window = BoolProperty(
        name="自动打开渲染窗口",
        default=True,
    )
    Scene.asg_hide_helper_meshes = BoolProperty(
        name="隐藏辅助物体",
        default=True,
    )

    Scene.asg_slot_survivor_1 = PointerProperty(type=bpy.types.Collection, name="求生者1")
    Scene.asg_slot_survivor_2 = PointerProperty(type=bpy.types.Collection, name="求生者2")
    Scene.asg_slot_survivor_3 = PointerProperty(type=bpy.types.Collection, name="求生者3")
    Scene.asg_slot_survivor_4 = PointerProperty(type=bpy.types.Collection, name="求生者4")
    Scene.asg_slot_hunter = PointerProperty(type=bpy.types.Collection, name="监管者")

    set_status("未启动")
    clear_error()


def unregister():
    global _SYNC_RUNNING
    _SYNC_RUNNING = False
    if bpy.app.timers.is_registered(sync_timer):
        bpy.app.timers.unregister(sync_timer)

    del Scene.asg_slot_hunter
    del Scene.asg_slot_survivor_4
    del Scene.asg_slot_survivor_3
    del Scene.asg_slot_survivor_2
    del Scene.asg_slot_survivor_1
    del Scene.asg_hide_helper_meshes
    del Scene.asg_auto_open_render_window
    del Scene.asg_poll_interval
    del Scene.asg_model_root_dir
    del Scene.asg_bp_api_url

    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
