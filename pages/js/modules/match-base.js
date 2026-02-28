/**
 * MatchBaseManager
 * Handles logic for the "Match Basic Info" text (Team configuration, Map, Lineup).
 * Refactored to support Dynamic Rosters and simplified Lineup selection.
 */
class MatchBaseManager {
    constructor() {
        this.STORAGE_KEY = 'localBp_matchBase';
        this.state = this.getDefaultState();
        this.saveTimer = null;
    }

    getDefaultState() {
        return {
            mapName: '',
            teamA: {
                name: 'A队',
                logo: '',
                // Dynamic roster, initially empty or with some placeholders
                roster: ['选手1', '选手2', '选手3', '选手4', '选手5']
            },
            teamB: {
                name: 'B队',
                logo: '',
                roster: ['选手1', '选手2', '选手3', '选手4', '选手5']
            },
            // The active lineup for the current match
            matchConfig: {
                // Fixed mode: A = 求生者, B = 监管者. Side swap is handled only by AB team rotation.
                mode: 'AvsB_Surv_Hunter',
                survivors: [],  // Array of names
                hunter: null    // Name
            },
            defaultImages: {
                slot0: '', slot1: '', slot2: '', slot3: '', hunter: ''
            }
        };
    }

    init() {
        this.load();
        this.render();
        console.log('MatchBaseManager initialized (Dynamic Roster).');
    }

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                const loaded = JSON.parse(raw);
                this.state = this.normalizeState(loaded);
            }
        } catch (e) {
            console.error('Failed to load matchBase:', e);
            this.state = this.getDefaultState();
        }
    }

    save() {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this._performSave();
        }, 300);
    }

    _performSave() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));

            // Sync to legacy global if needed (for scoreboards etc)
            // We might need to construct a 'legacy' structure if other parts expect 'members' array of 5
            // But ideally we update consumers. For now, we just save.

            if (window.syncMatchBaseToFrontend) {
                // Ensure legacy structure for frontend
                window.syncMatchBaseToFrontend();
            }

            // ✨ 修复：同时同步到比分和赛后数据，防止Logo/队名不同步
            if (window.syncMatchBaseToScoreAndPostMatch) {
                window.syncMatchBaseToScoreAndPostMatch();
            }

            // ✨ 修复：确保比分数据也能获取到最新的Logo并同步给插件
            // 如果页面上有 saveScoreData 函数（local-bp-logic.js），调用它会触发 localBp:updateScoreData
            if (window.saveScoreData) {
                window.saveScoreData();
            }
        } catch (e) {
            console.error('Failed to save matchBase:', e);
        }
    }

    normalizeState(loaded) {
        const def = this.getDefaultState();

        // Helper to convert old 5-slot members to dynamic roster if needed
        const normalizeRoster = (teamData) => {
            if (Array.isArray(teamData.roster)) return teamData.roster;
            if (Array.isArray(teamData.members)) return teamData.members.filter(m => m && m.trim());
            return [];
        };

        return {
            mapName: loaded.mapName || def.mapName,
            teamA: {
                name: loaded.teamA?.name || def.teamA.name,
                logo: loaded.teamA?.logo || def.teamA.logo,
                roster: normalizeRoster(loaded.teamA || {})
            },
            teamB: {
                name: loaded.teamB?.name || def.teamB.name,
                logo: loaded.teamB?.logo || def.teamB.logo,
                roster: normalizeRoster(loaded.teamB || {})
            },
            matchConfig: {
                mode: 'AvsB_Surv_Hunter',
                survivors: Array.isArray(loaded.matchConfig?.survivors) ? loaded.matchConfig.survivors : [],
                hunter: loaded.matchConfig?.hunter || null
            },
            defaultImages: { ...def.defaultImages, ...loaded.defaultImages }
        };
    }

    // ================= Logic Actions =================

    setMap(name) {
        this.state.mapName = name;
        this.save();
        // 选图后立即同步到本地BP状态，避免前台重开时因防抖延迟拿到旧地图
        try {
            if (window.syncMatchBaseToFrontend) {
                window.syncMatchBaseToFrontend();
            }
        } catch (e) {
            console.warn('[MatchBaseManager] setMap immediate sync failed:', e?.message || e);
        }
        // No full render needed
    }

    updateTeamName(teamKey, name) {
        if (teamKey === 'A') this.state.teamA.name = name;
        if (teamKey === 'B') this.state.teamB.name = name;
        this.save();
        // Maybe refresh lineup preview labels
        this.renderLineupSection();
    }

    setTeamLogo(teamKey, logoUrl) {
        if (teamKey === 'A') this.state.teamA.logo = logoUrl;
        if (teamKey === 'B') this.state.teamB.logo = logoUrl;
        this.save();
        document.getElementById(`baseTeam${teamKey}LogoPreview`).src = logoUrl;
        document.getElementById(`baseTeam${teamKey}LogoPreview`).style.display = 'block';
    }

    // --- Roster Management ---

    addMember(teamKey) {
        const team = teamKey === 'A' ? this.state.teamA : this.state.teamB;
        team.roster.push('新选手');
        this.save();
        this.renderRoster(teamKey);
        this.renderLineupSection();
    }

    updateMemberName(teamKey, index, newName) {
        const team = teamKey === 'A' ? this.state.teamA : this.state.teamB;
        const oldName = team.roster[index];
        team.roster[index] = newName;

        // Update Lineup references
        const { survivors, hunter } = this.state.matchConfig;
        const sIdx = survivors.indexOf(oldName);
        if (sIdx !== -1) survivors[sIdx] = newName;
        if (hunter === oldName) this.state.matchConfig.hunter = newName;

        this.save();
        this.renderLineupSection();
    }

    removeMember(teamKey, index) {
        const team = teamKey === 'A' ? this.state.teamA : this.state.teamB;
        if (!confirm(`确认删除选手 "${team.roster[index]}"？`)) return;

        const removedName = team.roster[index];
        team.roster.splice(index, 1);

        // Remove from lineup if present
        this.state.matchConfig.survivors = this.state.matchConfig.survivors.filter(n => n !== removedName);
        if (this.state.matchConfig.hunter === removedName) this.state.matchConfig.hunter = null;

        this.save();
        this.renderRoster(teamKey);
        this.renderLineupSection();
    }

    swapTeams() {
        const temp = JSON.parse(JSON.stringify(this.state.teamA));
        this.state.teamA = JSON.parse(JSON.stringify(this.state.teamB));
        this.state.teamB = temp;

        // Reset lineup to be safe
        this.state.matchConfig.survivors = [];
        this.state.matchConfig.hunter = null;

        this.save();
        this.render();
        if (typeof window.swapScoreTeamsData === 'function') {
            window.swapScoreTeamsData();
        }
        if (typeof window.swapAutoGlobalBanRoundsByTeamRotation === 'function') {
            Promise.resolve(window.swapAutoGlobalBanRoundsByTeamRotation()).catch(() => { });
        }
        // 轮换后强制同步一次全局BP展示信息（含对局记录meta）
        if (typeof window.syncMatchBaseToFrontend === 'function') {
            Promise.resolve(window.syncMatchBaseToFrontend()).catch(() => { });
        }
        if (typeof window.syncMatchBaseToScoreAndPostMatch === 'function') {
            Promise.resolve(window.syncMatchBaseToScoreAndPostMatch()).catch(() => { });
        }
        alert('AB队信息已互换 (阵容已重置)');
    }

    reset() {
        if (!confirm("确定重置所有对局基础信息？")) return;
        this.state = this.getDefaultState();
        this.save();
        this.render();
    }

    // --- Matches / Lineup ---

    setMatchMode(mode) {
        // Mode switch is deprecated. Keep a stable single mode to avoid conflicts with AB swap.
        this.state.matchConfig.mode = 'AvsB_Surv_Hunter';
        this.save();
        this.renderRoster('A');
        this.renderRoster('B');
        this.renderLineupSection();
    }

    toggleLineupSurvivor(name) {
        const list = this.state.matchConfig.survivors;
        const idx = list.indexOf(name);
        if (idx >= 0) {
            list.splice(idx, 1);
        } else {
            if (list.length >= 4) return alert('最多选择4名求生者');
            list.push(name);
        }
        this.save();
        this.renderLineupSection();
    }

    setLineupHunter(name) {
        this.state.matchConfig.hunter = name;
        this.save();
        this.renderLineupSection();
    }

    applyLineupToPostMatch() {
        const { survivors, hunter } = this.state.matchConfig;
        if (survivors.length !== 4) return alert('请选择 4 名求生者');
        if (!hunter) return alert('请选择 1 名监管者');

        // Apply to PostMatch inputs
        survivors.forEach((name, i) => {
            const el = document.getElementById(`pmS${i + 1}Name`);
            if (el) el.value = name;
        });
        const hEl = document.getElementById('pmHunterName');
        if (hEl) hEl.value = hunter;

        if (window.savePostMatch) window.savePostMatch();

        // Sync to Frontend Local BP (Display Names when slot is empty)
        if (window.syncMatchBaseToFrontend) {
            window.syncMatchBaseToFrontend();
        }

        // 使用自定义Toast或者简单的控制台日志，避免alert阻断
        console.log('阵容已应用到赛后数据！');
        if (window.showToast) {
            window.showToast('阵容已应用到赛后数据并同步到前台', 'success');
        } else {
            // Fallback minimal alert if no toast, but maybe just silence is better?
            // Or use a temporary text on the button?
            // Let's stick to no alert to fix the "un-editable" issue potential cause.
        }
    }

    // ================= Rendering =================

    render() {
        this.renderMap();
        this.renderTeamHeader('A');
        this.renderTeamHeader('B');
        this.renderRoster('A');
        this.renderRoster('B');
        this.renderLineupSection();
    }

    renderMap() {
        const el = document.getElementById('baseMapName');
        if (el) {
            // Add current value to options if missing
            if (this.state.mapName && !Array.from(el.options).some(o => o.value === this.state.mapName)) {
                const opt = new Option(this.state.mapName, this.state.mapName);
                el.add(opt);
            }
            el.value = this.state.mapName;
        }
    }

    renderTeamHeader(teamKey) {
        const data = teamKey === 'A' ? this.state.teamA : this.state.teamB;
        const nameEl = document.getElementById(`baseTeam${teamKey}Name`);
        if (nameEl) nameEl.value = data.name;

        const logoEl = document.getElementById(`baseTeam${teamKey}LogoPreview`);
        if (logoEl) {
            logoEl.src = data.logo || '';
            logoEl.style.display = data.logo ? 'block' : 'none';
        }
    }

    renderRoster(teamKey) {
        const team = teamKey === 'A' ? this.state.teamA : this.state.teamB;
        const container = document.getElementById(`team${teamKey}-roster-container`);
        if (!container) return;

        container.innerHTML = '';

        const isSurvTeam = teamKey === 'A';
        const isHuntTeam = !isSurvTeam;

        team.roster.forEach((name, index) => {
            const div = document.createElement('div');
            div.className = 'member-compact-row';
            div.style.display = 'flex';
            div.style.gap = '8px';
            div.style.marginBottom = '6px';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'player-name-input';
            input.value = name;
            input.placeholder = '选手名称';
            // 使用 onblur 而不是 onchange，避免干扰中文输入法
            input.onblur = (e) => this.updateMemberName(teamKey, index, e.target.value);

            const pick = document.createElement('label');
            pick.style.display = 'flex';
            pick.style.alignItems = 'center';
            pick.style.gap = '4px';
            pick.style.fontSize = '12px';
            pick.style.color = isSurvTeam ? '#059669' : '#dc2626';

            const pickInput = document.createElement('input');
            pickInput.type = isSurvTeam ? 'checkbox' : 'radio';
            if (isHuntTeam) pickInput.name = 'lineup_hunter';
            const trimmed = (name || '').trim();
            if (!trimmed) pickInput.disabled = true;
            if (isSurvTeam) {
                pickInput.checked = this.state.matchConfig.survivors.includes(name);
                pickInput.onclick = () => {
                    if (!trimmed) return;
                    this.toggleLineupSurvivor(name);
                };
            } else {
                pickInput.checked = this.state.matchConfig.hunter === name;
                pickInput.onclick = () => {
                    if (!trimmed) return;
                    this.setLineupHunter(name);
                };
            }
            const pickText = document.createElement('span');
            pickText.textContent = '上场';
            pick.append(pickInput, pickText);

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-danger btn-small';
            delBtn.textContent = '×';
            delBtn.onclick = () => this.removeMember(teamKey, index);

            div.append(input, pick, delBtn);
            container.appendChild(div);
        });

        // Add Member Button
        const addBtn = document.createElement('button');
        addBtn.className = 'btn btn-primary btn-small';
        addBtn.style.marginTop = '4px';
        addBtn.style.width = '100%';
        addBtn.textContent = '+ 添加选手';
        addBtn.onclick = () => this.addMember(teamKey);

        container.appendChild(addBtn);
    }

    renderLineupSection() {
        const container = document.getElementById('lineup-mode-container');
        if (container) {
            container.innerHTML = '';
            container.style.display = 'none';
        }

        const sDisplay = document.getElementById('currentSurvivorsDisplay');
        const hDisplay = document.getElementById('currentHunterDisplay');
        if (sDisplay) {
            if (this.state.matchConfig.survivors.length === 0) {
                sDisplay.textContent = '未选择';
                sDisplay.style.color = '#9ca3af';
            } else {
                sDisplay.textContent = this.state.matchConfig.survivors.join(', ');
                sDisplay.style.color = '#059669';
            }
        }
        if (hDisplay) {
            if (!this.state.matchConfig.hunter) {
                hDisplay.textContent = '未选择';
                hDisplay.style.color = '#9ca3af';
            } else {
                hDisplay.textContent = this.state.matchConfig.hunter;
                hDisplay.style.color = '#dc2626';
            }
        }
    }
}

window.baseManager = new MatchBaseManager();
