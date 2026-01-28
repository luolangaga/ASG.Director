/**
 * MatchBaseManager
 * Handles logic for the "Match Basic Info" text (Team configuration, Map, Lineup).
 * Refactored to support Dynamic Rosters and simplified Lineup selection.
 */
class MatchBaseManager {
    constructor() {
        this.STORAGE_KEY = 'localBp_matchBase';
        this.state = this.getDefaultState();
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
                mode: 'AvsB_Surv_Hunter', // 'AvsB_Surv_Hunter' (A=Surv, B=Hunt) or 'BvsA_Surv_Hunter' (B=Surv, A=Hunt)
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
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));

            // Sync to legacy global if needed (for scoreboards etc)
            // We might need to construct a 'legacy' structure if other parts expect 'members' array of 5
            // But ideally we update consumers. For now, we just save.

            if (window.syncMatchBaseToFrontend) {
                // Ensure legacy structure for frontend
                window.syncMatchBaseToFrontend();
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
                mode: loaded.matchConfig?.mode || 'AvsB_Surv_Hunter',
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
        // mode: 'AvsB_Surv_Hunter'  (A=Surv, B=Hunt)  
        //       'BvsA_Surv_Hunter'  (B=Surv, A=Hunt)
        this.state.matchConfig.mode = mode;
        // Clear selection on mode change? Maybe safer.
        this.state.matchConfig.survivors = [];
        this.state.matchConfig.hunter = null;
        this.save();
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

            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-danger btn-small';
            delBtn.textContent = '×';
            delBtn.onclick = () => this.removeMember(teamKey, index);

            div.append(input, delBtn);
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
        const mode = this.state.matchConfig.mode; // 'AvsB_Surv_Hunter'
        const container = document.getElementById('lineup-config-container');
        if (!container) return; // Need to create this in HTML

        // Render Mode Selection
        const renderModeSelector = () => {
            const div = document.createElement('div');
            div.style.marginBottom = '15px';
            div.innerHTML = `
                <div style="font-weight:bold;margin-bottom:5px;">对阵模式</div>
                <div style="display:flex;gap:10px;">
                    <label class="mode-card ${mode === 'AvsB_Surv_Hunter' ? 'active' : ''}" 
                           onclick="baseManager.setMatchMode('AvsB_Surv_Hunter')"
                           style="padding:10px;border:2px solid ${mode === 'AvsB_Surv_Hunter' ? '#667eea' : '#e2e8f0'};border-radius:8px;cursor:pointer;background:${mode === 'AvsB_Surv_Hunter' ? '#eff6ff' : '#fff'};flex:1;">
                        <span style="color:#2563eb;font-weight:bold;">${this.state.teamA.name}</span> (人) <br> vs <br> <span style="color:#dc2626;font-weight:bold;">${this.state.teamB.name}</span> (屠)
                    </label>
                    <label class="mode-card ${mode === 'BvsA_Surv_Hunter' ? 'active' : ''}" 
                           onclick="baseManager.setMatchMode('BvsA_Surv_Hunter')"
                           style="padding:10px;border:2px solid ${mode === 'BvsA_Surv_Hunter' ? '#667eea' : '#e2e8f0'};border-radius:8px;cursor:pointer;background:${mode === 'BvsA_Surv_Hunter' ? '#eff6ff' : '#fff'};flex:1;">
                        <span style="color:#2563eb;font-weight:bold;">${this.state.teamB.name}</span> (人) <br> vs <br> <span style="color:#dc2626;font-weight:bold;">${this.state.teamA.name}</span> (屠)
                    </label>
                </div>
             `;
            return div;
        };

        container.innerHTML = '';
        container.appendChild(renderModeSelector());

        // Determine which team is Surv, which is Hunter
        const survTeam = mode.startsWith('A') ? this.state.teamA : this.state.teamB;
        const huntTeam = mode.startsWith('A') ? this.state.teamB : this.state.teamA;

        // Render Selector Columns
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gap = '15px';

        // Survivor Column
        const sCol = document.createElement('div');
        sCol.innerHTML = `<div style="font-weight:bold;color:#10b981;margin-bottom:8px;">选择 4 名求生者 (${survTeam.name})</div>`;
        const sList = document.createElement('div');
        sList.style.display = 'flex';
        sList.style.flexDirection = 'column';
        sList.style.gap = '5px';

        survTeam.roster.forEach(name => {
            const isChecked = this.state.matchConfig.survivors.includes(name);
            const lbl = document.createElement('label');
            lbl.style.cssText = `display:flex;align-items:center;gap:8px;padding:6px;border:1px solid #e2e8f0;border-radius:4px;cursor:pointer;background:${isChecked ? '#f0fdf4' : '#fff'};border-color:${isChecked ? '#48bb78' : '#e2e8f0'}`;
            lbl.innerHTML = `<input type="checkbox" ${isChecked ? 'checked' : ''}> ${name}`;
            lbl.querySelector('input').onclick = () => this.toggleLineupSurvivor(name);
            sList.appendChild(lbl);
        });
        sCol.appendChild(sList);

        // Hunter Column
        const hCol = document.createElement('div');
        hCol.innerHTML = `<div style="font-weight:bold;color:#ef4444;margin-bottom:8px;">选择 1 名监管者 (${huntTeam.name})</div>`;
        const hList = document.createElement('div');
        hList.style.display = 'flex';
        hList.style.flexDirection = 'column';
        hList.style.gap = '5px';

        huntTeam.roster.forEach(name => {
            const isChecked = this.state.matchConfig.hunter === name;
            const lbl = document.createElement('label');
            lbl.style.cssText = `display:flex;align-items:center;gap:8px;padding:6px;border:1px solid #e2e8f0;border-radius:4px;cursor:pointer;background:${isChecked ? '#fef2f2' : '#fff'};border-color:${isChecked ? '#f87171' : '#e2e8f0'}`;
            lbl.innerHTML = `<input type="radio" name="hunter_select" ${isChecked ? 'checked' : ''}> ${name}`;
            lbl.querySelector('input').onclick = () => this.setLineupHunter(name);
            hList.appendChild(lbl);
        });
        hCol.appendChild(hList);

        grid.appendChild(sCol);
        grid.appendChild(hCol);
        container.appendChild(grid);

        // Update Summary
        const sDisplay = document.getElementById('currentSurvivorsDisplay');
        const hDisplay = document.getElementById('currentHunterDisplay');
        if (sDisplay) sDisplay.textContent = this.state.matchConfig.survivors.join(', ') || '未选择';
        if (hDisplay) hDisplay.textContent = this.state.matchConfig.hunter || '未选择';
    }
}

window.baseManager = new MatchBaseManager();
