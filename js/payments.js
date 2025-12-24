// ==================== PAYMENTS ====================
        // ==================== UTILITIES ====================
        function renderPagination(containerId, total, currentPage, onPageChange) {
            const totalPages = Math.ceil(total / PAGE_SIZE);
            if (totalPages <= 1) { document.getElementById(containerId).innerHTML = ''; return; }
            document.getElementById(containerId).innerHTML = `
                <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="(${onPageChange})(${currentPage - 1})">← Prev</button>
                <span class="pagination-info">Page ${currentPage} of ${totalPages}</span>
                <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="(${onPageChange})(${currentPage + 1})">Next →</button>
            `;
        }

        function showToast(message, type = 'success', duration = 4000) {
            const toast = document.getElementById('toast');
            const toastIcon = document.getElementById('toastIcon');
            const toastMessage = document.getElementById('toastMessage');
            const toastProgress = document.getElementById('toastProgress');
            
            // Set icon based on type
            const icons = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };
            toastIcon.textContent = icons[type] || icons.success;
            toastMessage.textContent = message;
            
            // Reset and restart progress animation
            toastProgress.style.animation = 'none';
            toastProgress.offsetHeight; // Trigger reflow
            toastProgress.style.animation = `toastProgress ${duration}ms linear forwards`;
            
            toast.className = `toast ${type} show`;
            
            // Clear any existing timeout
            if (window.toastTimeout) clearTimeout(window.toastTimeout);
            window.toastTimeout = setTimeout(() => hideToast(), duration);
        }
        
        function hideToast() {
            const toast = document.getElementById('toast');
            toast.classList.remove('show');
            if (window.toastTimeout) {
                clearTimeout(window.toastTimeout);
                window.toastTimeout = null;
            }
        }

        async function exportCreators() {
            showToast('Preparing export...', 'info');
            
            const brand = document.getElementById('creatorsBrandFilter').value;
            const startDate = document.getElementById('creatorsDateFilterStart').value;
            const endDate = document.getElementById('creatorsDateFilterEnd').value;
            
            if (!startDate || !endDate) {
                showToast('Please select a date range first', 'error');
                return;
            }
            
            let query = supabaseClient.from('creator_performance').select('*')
                .gte('report_date', startDate)
                .lte('report_date', endDate)
                .eq('period_type', 'daily')
                .limit(50000);
            if (brand !== 'all') query = query.eq('brand', brand);
            
            const { data, error } = await query;
            
            if (error) {
                showToast('Error fetching data', 'error');
                return;
            }
            
            // Aggregate by creator
            const creatorMap = new Map();
            (data || []).forEach(row => {
                const key = `${row.creator_name}|||${row.brand}`;
                if (!creatorMap.has(key)) {
                    creatorMap.set(key, {
                        creator_name: row.creator_name,
                        brand: row.brand,
                        gmv: 0, orders: 0, videos: 0, items_sold: 0, 
                        est_commission: 0, live_streams: 0
                    });
                }
                const c = creatorMap.get(key);
                c.gmv += pFloat(row.gmv);
                c.orders += pInt(row.orders);
                c.videos += pInt(row.videos);
                c.items_sold += pInt(row.items_sold);
                c.est_commission += pFloat(row.est_commission);
                c.live_streams += pInt(row.live_streams);
            });
            
            const creators = [...creatorMap.values()].sort((a, b) => b.gmv - a.gmv);
            
            // Build CSV
            const headers = ['Creator', 'Brand', 'GMV', 'Orders', 'Videos', 'Items Sold', 'Est Commission', 'Live Streams', 'GMV per Video', 'Tier', 'Managed'];
            const rows = creators.map(c => {
                const tier = getTier(c.gmv);
                const managed = isManagedForBrand(c.creator_name, c.brand);
                const gmvPerVideo = c.videos > 0 ? (c.gmv / c.videos).toFixed(2) : '0';
                return [
                    c.creator_name,
                    BRAND_DISPLAY[c.brand] || c.brand,
                    c.gmv.toFixed(2),
                    c.orders,
                    c.videos,
                    c.items_sold,
                    c.est_commission.toFixed(2),
                    c.live_streams,
                    gmvPerVideo,
                    tier.name,
                    managed ? 'Yes' : 'No'
                ].join(',');
            });
            
            const csv = [headers.join(','), ...rows].join('\n');
            
            // Download
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `creators_${startDate}_to_${endDate}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast(`Exported ${creators.length} creators!`, 'success');
        }

        // ==================== KEYBOARD SHORTCUTS ====================
        const shortcuts = {
            // Command palette
            'k': { ctrl: true, action: () => openCommandPalette(), desc: 'Open command palette' },
            '/': { action: () => openCommandPalette(), desc: 'Open search' },
            
            // Modal controls
            'Escape': { action: () => closeAllModals(), desc: 'Close modals' },
            
            // View navigation (Ctrl+Number)
            '1': { ctrl: true, action: () => switchView('opscenter'), desc: 'Ops Center' },
            '2': { ctrl: true, action: () => switchView('overview'), desc: 'Dashboard' },
            '3': { ctrl: true, action: () => switchView('brands'), desc: 'Brands' },
            '4': { ctrl: true, action: () => switchView('creators'), desc: 'Creators' },
            '5': { ctrl: true, action: () => switchView('videos'), desc: 'Videos' },
            '6': { ctrl: true, action: () => switchView('products'), desc: 'Products' },
            '7': { ctrl: true, action: () => switchView('roster'), desc: 'Roster' },
            '8': { ctrl: true, action: () => switchView('payments'), desc: 'Payments' },
            '9': { ctrl: true, action: () => switchView('applications'), desc: 'Applications' },
            
            // Quick actions
            'r': { ctrl: true, shift: true, action: () => loadViewData(), desc: 'Refresh current view' },
            'n': { ctrl: true, action: () => focusSearch(), desc: 'Focus search input' },
            'u': { ctrl: true, shift: true, action: () => switchView('upload'), desc: 'Go to Upload' },
            
            // Help
            '?': { shift: true, action: () => showKeyboardShortcutsHelp(), desc: 'Show keyboard shortcuts' }
        };
        
        function focusSearch() {
            // Find the search input in the current view
            const currentView = document.querySelector('.view-section.active');
            if (currentView) {
                const searchInput = currentView.querySelector('.search-input, input[type="text"][placeholder*="Search"]');
                if (searchInput) {
                    searchInput.focus();
                    return;
                }
            }
            // Fallback to command palette
            openCommandPalette();
        }
        
        function showKeyboardShortcutsHelp() {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.id = 'keyboardHelpModal';
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
            
            modal.innerHTML = `
                <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 style="margin: 0;">⌨️ Keyboard Shortcuts</h2>
                        <button class="modal-close" onclick="document.getElementById('keyboardHelpModal').remove()">×</button>
                    </div>
                    <div class="modal-body" style="padding: 0;">
                        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border);">
                            <div style="font-weight: 600; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 12px;">Navigation</div>
                            <div style="display: grid; grid-template-columns: 100px 1fr; gap: 8px; font-size: 0.9rem;">
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + 1</kbd><span>Ops Center</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + 2</kbd><span>Dashboard</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + 3</kbd><span>Brands</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + 4</kbd><span>Creators</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + 5</kbd><span>Videos</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + 6</kbd><span>Products</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + 7</kbd><span>Roster</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + 8</kbd><span>Payments</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + 9</kbd><span>Applications</span>
                            </div>
                        </div>
                        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border);">
                            <div style="font-weight: 600; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 12px;">Actions</div>
                            <div style="display: grid; grid-template-columns: 100px 1fr; gap: 8px; font-size: 0.9rem;">
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + K</kbd><span>Command palette</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">/</kbd><span>Quick search</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl + N</kbd><span>Focus search input</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl+Shift+R</kbd><span>Refresh view</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Ctrl+Shift+U</kbd><span>Go to Upload</span>
                                <kbd style="background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; font-family: monospace;">Escape</kbd><span>Close modal</span>
                            </div>
                        </div>
                        <div style="padding: 16px 20px;">
                            <div style="font-weight: 600; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 12px;">Tips</div>
                            <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary); font-size: 0.85rem;">
                                <li>Press <kbd style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 0.8rem;">?</kbd> anytime to show this help</li>
                                <li>On Mac, use ⌘ instead of Ctrl</li>
                                <li>Press Escape in any input to unfocus</li>
                            </ul>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }

        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                if (e.key === 'Escape') {
                    e.target.blur();
                }
                return;
            }
            
            const key = e.key;
            const shortcut = shortcuts[key];
            
            if (shortcut) {
                const ctrlKey = e.ctrlKey || e.metaKey;
                const shiftKey = e.shiftKey;
                
                if ((shortcut.ctrl && ctrlKey) || (!shortcut.ctrl && !ctrlKey)) {
                    if ((shortcut.shift && shiftKey) || (!shortcut.shift && !shiftKey)) {
                        e.preventDefault();
                        shortcut.action();
                    }
                }
            }
        });

        // Settings nav toggle
        function toggleSettingsNav() {
            const group = document.getElementById('settingsNavGroup');
            const arrow = document.getElementById('settingsNavArrow');
            if (group.style.display === 'none' || !group.style.display) {
                group.style.display = 'block';
                arrow.textContent = '▼';
            } else {
                group.style.display = 'none';
                arrow.textContent = '▶';
            }
        }
        
        function toggleDataExplorerNav() {
            const group = document.getElementById('dataExplorerNavGroup');
            const arrow = document.getElementById('dataExplorerNavArrow');
            if (group.style.display === 'none' || !group.style.display) {
                group.style.display = 'block';
                arrow.textContent = '▼';
            } else {
                group.style.display = 'none';
                arrow.textContent = '▶';
            }
        }

        // Auto-expand settings if current view is in settings group
        function checkSettingsNavExpand(viewName) {
            const settingsViews = ['settings', 'goals', 'activity', 'datastatus', 'users'];
            if (settingsViews.includes(viewName)) {
                const group = document.getElementById('settingsNavGroup');
                const arrow = document.getElementById('settingsNavArrow');
                if (group) {
                    group.style.display = 'block';
                    arrow.textContent = '▼';
                }
            }
            
            const dataExplorerViews = ['creators', 'videos', 'products'];
            if (dataExplorerViews.includes(viewName)) {
                const group = document.getElementById('dataExplorerNavGroup');
                const arrow = document.getElementById('dataExplorerNavArrow');
                if (group) {
                    group.style.display = 'block';
                    arrow.textContent = '▼';
                }
            }
        }

        // Update alerts bell count
        function updateAlertsBell(count) {
            const bell = document.getElementById('alertsBell');
            const countEl = document.getElementById('alertsBellCount');
            if (countEl) countEl.textContent = count;
            if (bell) {
                if (count > 0) {
                    bell.classList.add('has-alerts');
                } else {
                    bell.classList.remove('has-alerts');
                }
            }
        }

        function closeAllModals() {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('show'));
            document.getElementById('commandPalette')?.classList.remove('show');
            closeMobileMenu();
        }

        // Command Palette
        function openCommandPalette() {
            let palette = document.getElementById('commandPalette');
            if (!palette) {
                palette = document.createElement('div');
                palette.id = 'commandPalette';
                palette.className = 'command-palette';
                palette.innerHTML = `
                    <div class="command-input-wrap">
                        <span class="command-icon">🔍</span>
                        <input type="text" id="commandInput" placeholder="Search creators, views, or type a command..." autocomplete="off">
                        <span class="command-hint">ESC to close</span>
                    </div>
                    <div class="command-results" id="commandResults"></div>
                `;
                document.body.appendChild(palette);
                
                // Add styles
                const style = document.createElement('style');
                style.textContent = `
                    .command-palette {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.7);
                        display: none;
                        justify-content: center;
                        padding-top: 15vh;
                        z-index: 10000;
                    }
                    .command-palette.show { display: flex; }
                    .command-input-wrap {
                        background: var(--bg-card);
                        border: 1px solid var(--border);
                        border-radius: 12px;
                        padding: 16px 20px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        width: 600px;
                        max-width: 90vw;
                    }
                    .command-icon { font-size: 1.2rem; }
                    .command-input-wrap input {
                        flex: 1;
                        background: transparent;
                        border: none;
                        outline: none;
                        color: var(--text-primary);
                        font-size: 1.1rem;
                        font-family: inherit;
                    }
                    .command-hint { font-size: 0.75rem; color: var(--text-muted); }
                    .command-results {
                        position: absolute;
                        top: calc(15vh + 60px);
                        width: 600px;
                        max-width: 90vw;
                        max-height: 50vh;
                        overflow-y: auto;
                        background: var(--bg-card);
                        border: 1px solid var(--border);
                        border-radius: 12px;
                        display: none;
                    }
                    .command-results.has-results { display: block; }
                    .command-result {
                        padding: 12px 20px;
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        cursor: pointer;
                        border-bottom: 1px solid var(--border);
                    }
                    .command-result:last-child { border-bottom: none; }
                    .command-result:hover { background: var(--bg-card-hover); }
                    .command-result.selected { background: var(--accent-dim); }
                    .command-result-icon { font-size: 1.2rem; }
                    .command-result-text { flex: 1; }
                    .command-result-title { font-weight: 600; }
                    .command-result-desc { font-size: 0.8rem; color: var(--text-muted); }
                    .command-result-shortcut { font-size: 0.7rem; color: var(--text-muted); background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px; }
                `;
                document.head.appendChild(style);
                
                // Input handler
                document.getElementById('commandInput').addEventListener('input', handleCommandSearch);
                document.getElementById('commandInput').addEventListener('keydown', handleCommandKeydown);
            }
            
            palette.classList.add('show');
            document.getElementById('commandInput').value = '';
            document.getElementById('commandInput').focus();
            document.getElementById('commandResults').innerHTML = '';
            document.getElementById('commandResults').classList.remove('has-results');
            
            // Show default options
            showDefaultCommands();
        }

        function showDefaultCommands() {
            const commands = [
                { icon: '🎯', title: 'Ops Center', desc: 'Creator health quadrants', action: () => switchView('opscenter'), shortcut: '⌘1' },
                { icon: '📊', title: 'Dashboard', desc: 'Main overview', action: () => switchView('overview'), shortcut: '⌘2' },
                { icon: '🏢', title: 'Brands', desc: 'Brand deep dive', action: () => switchView('brands'), shortcut: '⌘3' },
                { icon: '👥', title: 'Creators', desc: 'All creators', action: () => switchView('creators'), shortcut: '⌘4' },
                { icon: '🎬', title: 'Videos', desc: 'Video performance', action: () => switchView('videos'), shortcut: '⌘5' },
                { icon: '📦', title: 'Products', desc: 'Product analytics', action: () => switchView('products'), shortcut: '⌘6' },
                { icon: '📋', title: 'Roster', desc: 'Managed creators', action: () => switchView('roster'), shortcut: '⌘7' },
                { icon: '💰', title: 'Payments', desc: 'Payment tracking', action: () => switchView('payments'), shortcut: '⌘8' },
                { icon: '📝', title: 'Applications', desc: 'Creator applications', action: () => switchView('applications'), shortcut: '⌘9' },
                { icon: '📤', title: 'Upload Data', desc: 'Import new data', action: () => switchView('upload'), shortcut: '⌘⇧U' },
                { icon: '🔄', title: 'Refresh Data', desc: 'Reload current view', action: () => refreshCurrentView(), shortcut: '⌘⇧R' },
                { icon: '⌨️', title: 'Keyboard Shortcuts', desc: 'View all shortcuts', action: () => showKeyboardShortcutsHelp(), shortcut: '?' }
            ];
            
            renderCommandResults(commands);
        }

        let commandResults = [];
        let selectedIndex = 0;

        async function handleCommandSearch(e) {
            const query = e.target.value.toLowerCase().trim();
            
            if (!query) {
                showDefaultCommands();
                return;
            }
            
            const results = [];
            
            // Search views
            const views = [
                { icon: '🎯', title: 'Ops Center', desc: 'Creator health quadrants', action: () => switchView('opscenter') },
                { icon: '📊', title: 'Dashboard', desc: 'Main overview', action: () => switchView('overview') },
                { icon: '🏢', title: 'Brands', desc: 'Brand deep dive', action: () => switchView('brands') },
                { icon: '👥', title: 'Creators', desc: 'All creators', action: () => switchView('creators') },
                { icon: '🎬', title: 'Videos', desc: 'Video performance', action: () => switchView('videos') },
                { icon: '📦', title: 'Products', desc: 'Product analytics', action: () => switchView('products') },
                { icon: '📋', title: 'Roster', desc: 'Managed creators', action: () => switchView('roster') },
                { icon: '💰', title: 'Payments', desc: 'Payment tracking', action: () => switchView('payments') },
                { icon: '📝', title: 'Applications', desc: 'Creator applications', action: () => switchView('applications') },
                { icon: '📤', title: 'Upload', desc: 'Import new data', action: () => switchView('upload') },
                { icon: '🔄', title: 'Refresh', desc: 'Reload current view', action: () => refreshCurrentView() },
                { icon: '⌨️', title: 'Keyboard Shortcuts', desc: 'View all shortcuts', action: () => showKeyboardShortcutsHelp() }
            ];
            
            views.forEach(v => {
                if (v.title.toLowerCase().includes(query) || v.desc.toLowerCase().includes(query)) {
                    results.push(v);
                }
            });
            
            // Search creators
            if (query.length >= 2) {
                const matchingCreators = managedCreators
                    .filter(c => 
                        (c.real_name || '').toLowerCase().includes(query) ||
                        (c.discord_name || '').toLowerCase().includes(query) ||
                        (c.account_1 || '').toLowerCase().includes(query)
                    )
                    .slice(0, 5);
                
                matchingCreators.forEach(c => {
                    results.push({
                        icon: '👤',
                        title: c.real_name || c.discord_name || c.account_1,
                        desc: `${BRAND_DISPLAY[c.brand] || c.brand} • ${c.role || 'Creator'}`,
                        action: () => { switchView('roster'); editCreator(c.id); }
                    });
                });
            }
            
            renderCommandResults(results.length > 0 ? results : [{ icon: '🔍', title: 'No results', desc: `No matches for "${query}"`, action: () => {} }]);
        }

        function renderCommandResults(results) {
            commandResults = results;
            selectedIndex = 0;
            
            const container = document.getElementById('commandResults');
            container.innerHTML = results.map((r, i) => `
                <div class="command-result ${i === 0 ? 'selected' : ''}" data-index="${i}">
                    <span class="command-result-icon">${r.icon}</span>
                    <div class="command-result-text">
                        <div class="command-result-title">${r.title}</div>
                        <div class="command-result-desc">${r.desc}</div>
                    </div>
                    ${r.shortcut ? `<span class="command-result-shortcut">${r.shortcut}</span>` : ''}
                </div>
            `).join('');
            
            container.classList.toggle('has-results', results.length > 0);
            
            // Add click handlers
            container.querySelectorAll('.command-result').forEach(el => {
                el.addEventListener('click', () => {
                    const index = parseInt(el.dataset.index);
                    executeCommand(index);
                });
            });
        }

        function handleCommandKeydown(e) {
            if (e.key === 'Escape') {
                document.getElementById('commandPalette').classList.remove('show');
                return;
            }
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, commandResults.length - 1);
                updateSelectedResult();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelectedResult();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                executeCommand(selectedIndex);
            }
        }

        function updateSelectedResult() {
            document.querySelectorAll('.command-result').forEach((el, i) => {
                el.classList.toggle('selected', i === selectedIndex);
            });
            // Scroll into view
            document.querySelector('.command-result.selected')?.scrollIntoView({ block: 'nearest' });
        }

        function executeCommand(index) {
            if (commandResults[index]) {
                commandResults[index].action();
                document.getElementById('commandPalette').classList.remove('show');
            }
        }

        // ==================== DATA FRESHNESS ====================
        async function loadBrandFreshness() {
            try {
                const container = document.getElementById('brandFreshnessIndicators');
                if (!container) return; // Element was removed
                
                const { data, error } = await supabaseClient
                    .from('upload_tracking')
                    .select('*')
                    .order('uploaded_at', { ascending: false });
                
                if (error) throw error;
                
                if (!data || data.length === 0) {
                    container.innerHTML = `<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center;">No upload data</div>`;
                    return;
                }
                
                // Group by brand, get latest upload per brand
                const brandLatest = {};
                data.forEach(d => {
                    if (!brandLatest[d.brand] || new Date(d.uploaded_at) > new Date(brandLatest[d.brand].uploaded_at)) {
                        brandLatest[d.brand] = d;
                    }
                });
                
                let html = '';
                Object.entries(brandLatest).forEach(([brand, info]) => {
                    const uploadDate = new Date(info.uploaded_at);
                    const now = new Date();
                    const daysAgo = Math.floor((now - uploadDate) / (1000 * 60 * 60 * 24));
                    
                    let statusColor = 'var(--success)';
                    let statusIcon = '🟢';
                    if (daysAgo >= 3) {
                        statusColor = 'var(--danger)';
                        statusIcon = '🔴';
                    } else if (daysAgo >= 1) {
                        statusColor = 'var(--warning)';
                        statusIcon = '🟡';
                    }
                    
                    const displayName = BRAND_DISPLAY[brand] || brand;
                    const timeAgo = daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
                    
                    html += `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 0.75rem;">
                            <span style="color: var(--text-secondary);">${statusIcon} ${displayName}</span>
                            <span style="color: ${statusColor};">${timeAgo}</span>
                        </div>
                    `;
                });
                
                container.innerHTML = html;
            } catch (err) {
                console.error('Failed to load freshness:', err);
            }
        }

        // ==================== ACTIVITY LOG ====================
        async function loadActivityData() {
            showLoading('activity', 'Loading activity log...');
            const typeFilter = document.getElementById('activityTypeFilter')?.value || 'all';
            const brandFilter = document.getElementById('activityBrandFilter')?.value || 'all';
            
            try {
                let query = supabaseClient
                    .from('activity_log')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);
                
                if (typeFilter !== 'all') query = query.eq('activity_type', typeFilter);
                if (brandFilter !== 'all') query = query.eq('brand', brandFilter);
                
                const { data, error } = await query;
                
                if (error) throw error;
                
                const container = document.getElementById('activityList');
                
                if (!data || data.length === 0) {
                    container.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">No activity recorded yet</div>`;
                    return;
                }
                
                const typeIcons = {
                    'upload': '📤',
                    'edit': '✏️',
                    'delete': '🗑️',
                    'payment': '💳',
                    'note': '📝',
                    'login': '🔑',
                    'export': '📥'
                };
                
                const typeColors = {
                    'upload': 'var(--success)',
                    'edit': 'var(--blue)',
                    'delete': 'var(--danger)',
                    'payment': 'var(--accent)',
                    'note': 'var(--purple)',
                    'login': 'var(--text-muted)',
                    'export': 'var(--cyan)'
                };
                
                container.innerHTML = data.map(a => {
                    const time = new Date(a.created_at).toLocaleString();
                    const icon = typeIcons[a.activity_type] || '📋';
                    const color = typeColors[a.activity_type] || 'var(--text-muted)';
                    const brandDisplay = a.brand ? (BRAND_DISPLAY[a.brand] || a.brand) : '';
                    
                    return `
                        <div style="display: flex; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border);">
                            <div style="font-size: 1.3rem;">${icon}</div>
                            <div style="flex: 1;">
                                <div style="font-weight: 500; color: var(--text-primary);">${a.description}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">
                                    ${a.user_name || a.user_email || 'System'} 
                                    ${brandDisplay ? `• <span style="color: ${color};">${brandDisplay}</span>` : ''}
                                    • ${time}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (err) {
                console.error('Failed to load activity:', err);
            } finally {
                hideLoading('activity');
            }
        }

        async function logActivity(type, description, brand = null, details = null) {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                const user = session?.user;
                
                await supabaseClient.from('activity_log').insert({
                    activity_type: type,
                    description: description,
                    brand: brand,
                    details: details,
                    user_email: user?.email,
                    user_name: user?.user_metadata?.name || user?.user_metadata?.full_name
                });
            } catch (err) {
                console.warn('Failed to log activity:', err);
            }
        }

        // ==================== CREATOR NOTES ====================
        let currentNotesCreator = null;

        function openNotesModal(creatorHandle, creatorName, brand) {
            currentNotesCreator = { handle: creatorHandle, name: creatorName, brand: brand };
            document.getElementById('notesCreatorHandle').value = creatorHandle;
            document.getElementById('notesCreatorBrand').value = brand || '';
            document.getElementById('notesCreatorName').textContent = creatorName || creatorHandle;
            document.getElementById('noteText').value = '';
            document.getElementById('noteType').value = 'general';
            document.getElementById('notePinned').checked = false;
            
            loadCreatorNotes(creatorHandle);
            document.getElementById('notesModal').classList.add('show');
        }

        function closeNotesModal() {
            document.getElementById('notesModal').classList.remove('show');
            currentNotesCreator = null;
        }

        async function loadCreatorNotes(creatorHandle) {
            const container = document.getElementById('notesHistory');
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading...</div>';
            
            try {
                const { data, error } = await supabaseClient
                    .from('creator_notes')
                    .select('*')
                    .eq('creator_handle', creatorHandle)
                    .order('is_pinned', { ascending: false })
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                
                if (!data || data.length === 0) {
                    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No notes yet</div>';
                    return;
                }
                
                const typeIcons = {
                    'general': '📋',
                    'payment': '💳',
                    'performance': '📈',
                    'communication': '💬',
                    'urgent': '🚨'
                };
                
                container.innerHTML = data.map(n => {
                    const time = new Date(n.created_at).toLocaleString();
                    const icon = typeIcons[n.note_type] || '📋';
                    const pinIcon = n.is_pinned ? '📌 ' : '';
                    
                    return `
                        <div style="background: var(--bg-secondary); padding: 12px; border-radius: 8px; margin-bottom: 8px; ${n.is_pinned ? 'border-left: 3px solid var(--accent);' : ''}">
                            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
                                <span style="font-size: 0.8rem; font-weight: 600;">${pinIcon}${icon} ${n.note_type.charAt(0).toUpperCase() + n.note_type.slice(1)}</span>
                                <button onclick="deleteNote('${n.id}')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 0.8rem;">🗑️</button>
                            </div>
                            <div style="color: var(--text-primary); font-size: 0.9rem; margin-bottom: 6px;">${n.note}</div>
                            <div style="color: var(--text-muted); font-size: 0.75rem;">${n.created_by || 'Unknown'} • ${time}</div>
                        </div>
                    `;
                }).join('');
            } catch (err) {
                console.error('Failed to load notes:', err);
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--danger);">Failed to load notes</div>';
            }
        }

        async function saveCreatorNote() {
            const text = document.getElementById('noteText').value.trim();
            if (!text) {
                showToast('Please enter a note', 'error');
                return;
            }
            
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                const userName = session?.user?.user_metadata?.name || session?.user?.email || 'Admin';
                
                const { error } = await supabaseClient.from('creator_notes').insert({
                    creator_handle: document.getElementById('notesCreatorHandle').value,
                    brand: document.getElementById('notesCreatorBrand').value || null,
                    note_type: document.getElementById('noteType').value,
                    note: text,
                    is_pinned: document.getElementById('notePinned').checked,
                    created_by: userName
                });
                
                if (error) throw error;
                
                document.getElementById('noteText').value = '';
                showToast('Note added!', 'success');
                loadCreatorNotes(document.getElementById('notesCreatorHandle').value);
                
                logActivity('note', `Added note for ${currentNotesCreator?.name || currentNotesCreator?.handle}`, currentNotesCreator?.brand);
            } catch (err) {
                console.error('Failed to save note:', err);
                showToast('Failed to save note', 'error');
            }
        }

        async function deleteNote(noteId) {
            if (!confirm('Delete this note?')) return;
            
            try {
                const { error } = await supabaseClient.from('creator_notes').delete().eq('id', noteId);
                if (error) throw error;
                
                showToast('Note deleted', 'success');
                loadCreatorNotes(document.getElementById('notesCreatorHandle').value);
            } catch (err) {
                console.error('Failed to delete note:', err);
                showToast('Failed to delete note', 'error');
            }
        }

        // ==================== PAYMENTS (creator_payments table) ====================
        let selectedPaymentIds = new Set();
        let paymentsStatusFilter = 'all';
        let allPaymentsData = [];

        async function loadPaymentsView() {
            showLoading('payments', 'Loading payment data...');
            const periodFilter = document.getElementById('paymentsPeriodFilter')?.value || '';
            const brandFilter = document.getElementById('paymentsBrandFilter')?.value || 'all';
            
            try {
                // Load from creator_payments table
                let query = supabaseClient
                    .from('creator_payments')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (periodFilter) query = query.eq('period_month', periodFilter);
                if (brandFilter !== 'all') query = query.eq('brand', brandFilter);
                if (paymentsStatusFilter !== 'all') query = query.eq('status', paymentsStatusFilter);
                
                const { data, error } = await query;
                
                if (error) throw error;
                
                allPaymentsData = data || [];
                
                // Load GMV data for ROI calculation (last 30 days by default, or period-specific)
                const gmvByCreatorBrand = {};
                if (allPaymentsData.length > 0) {
                    // Get unique creator-brand pairs
                    const creatorBrands = [...new Set(allPaymentsData.map(p => `${p.creator_name}|${p.brand}`))];
                    const creators = [...new Set(allPaymentsData.map(p => p.creator_name.toLowerCase()))];
                    
                    // Fetch GMV for last 30 days
                    const endDate = new Date();
                    const startDate = new Date();
                    startDate.setDate(startDate.getDate() - 30);
                    
                    const { data: perfData } = await supabaseClient
                        .from('creator_performance')
                        .select('creator_name, brand, gmv')
                        .gte('report_date', startDate.toISOString().split('T')[0])
                        .lte('report_date', endDate.toISOString().split('T')[0]);
                    
                    if (perfData) {
                        perfData.forEach(p => {
                            const key = `${p.creator_name.toLowerCase()}|${p.brand}`;
                            gmvByCreatorBrand[key] = (gmvByCreatorBrand[key] || 0) + (parseFloat(p.gmv) || 0);
                        });
                    }
                }
                
                // Attach GMV to payment data
                allPaymentsData = allPaymentsData.map(p => ({
                    ...p,
                    gmv30d: gmvByCreatorBrand[`${p.creator_name.toLowerCase()}|${p.brand}`] || 0
                }));
                
                // Update stats
                let pendingTotal = 0, approvedTotal = 0, paidTotal = 0;
                
                allPaymentsData.forEach(p => {
                    const amt = parseFloat(p.amount) || 0;
                    if (p.status === 'pending') pendingTotal += amt;
                    if (p.status === 'approved') approvedTotal += amt;
                    if (p.status === 'paid') paidTotal += amt;
                });
                
                document.getElementById('paymentsPendingTotal').textContent = fmtMoney(pendingTotal);
                document.getElementById('paymentsApprovedTotal').textContent = fmtMoney(approvedTotal);
                document.getElementById('paymentsPaidTotal').textContent = fmtMoney(paidTotal);
                document.getElementById('paymentsCount').textContent = allPaymentsData.length;
                
                // Populate period filter
                await populatePaymentsPeriodFilter();
                
                // Render table
                renderPaymentsTable(allPaymentsData);
                
                // Load creators on retainer
                await loadRetainerCreators();
                
            } catch (err) {
                console.error('Failed to load payments:', err);
                showToast('Failed to load payments', 'error');
            } finally {
                hideLoading('payments');
            }
        }

        function renderPaymentsTable(data) {
            const tbody = document.getElementById('paymentsTableBody');
            
            if (!data || data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" style="text-align: center; padding: 60px 40px;">
                            <div style="font-size: 2rem; margin-bottom: 12px;">💰</div>
                            <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">No payment records yet</div>
                            <div style="color: var(--text-muted); font-size: 0.9rem;">Click <strong>Add Payment</strong> to record a retainer claim, top-up, or bonus</div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            const statusBadges = {
                'pending': '<span class="badge" style="background: var(--warning-dim); color: var(--warning);">⏳ Pending</span>',
                'approved': '<span class="badge" style="background: var(--blue-dim); color: var(--blue);">✓ Approved</span>',
                'paid': '<span class="badge" style="background: var(--success-dim); color: var(--success);">✅ Paid</span>',
                'rejected': '<span class="badge" style="background: var(--danger-dim); color: var(--danger);">❌ Rejected</span>'
            };
            
            const typeBadges = {
                'retainer': '<span class="badge" style="background: var(--accent-dim); color: var(--accent);">💵 Retainer</span>',
                'commission_topup': '<span class="badge" style="background: var(--purple-dim); color: var(--purple);">📈 Top-Up</span>',
                'bonus': '<span class="badge" style="background: var(--success-dim); color: var(--success);">🎁 Bonus</span>',
                'other': '<span class="badge" style="background: var(--bg-tertiary); color: var(--text-muted);">📋 Other</span>'
            };
            
            tbody.innerHTML = data.map(p => {
                const dates = [];
                if (p.date_submitted) dates.push(`Sub: ${new Date(p.date_submitted).toLocaleDateString()}`);
                if (p.date_approved) dates.push(`Apr: ${new Date(p.date_approved).toLocaleDateString()}`);
                if (p.date_paid) dates.push(`Paid: ${new Date(p.date_paid).toLocaleDateString()}`);
                
                // Calculate ROI for retainer payments
                let roiDisplay = '<span style="color: var(--text-muted);">—</span>';
                if (p.payment_type === 'retainer' && p.amount > 0 && p.gmv30d !== undefined) {
                    const roi = (p.gmv30d / p.amount).toFixed(1);
                    const roiColor = roi >= 1 ? 'var(--success)' : 'var(--error)';
                    roiDisplay = `<span style="color: ${roiColor}; font-weight: 600;">${roi}x</span>`;
                }
                
                return `
                <tr data-id="${p.id}">
                    <td><input type="checkbox" class="payment-check" data-id="${p.id}" ${selectedPaymentIds.has(p.id) ? 'checked' : ''} onchange="togglePaymentSelect('${p.id}')"></td>
                    <td><div class="creator-name">@${p.creator_name}</div></td>
                    <td><span class="badge-brand">${BRAND_DISPLAY[p.brand] || p.brand}</span></td>
                    <td>${typeBadges[p.payment_type] || p.payment_type}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${fmtMoney(p.amount)}</td>
                    <td style="font-size: 0.85rem; color: var(--text-muted);">${p.period_month || '—'}</td>
                    <td style="text-align: center;">${roiDisplay}</td>
                    <td>${statusBadges[p.status] || p.status}</td>
                    <td style="font-size: 0.75rem; color: var(--text-muted);">${dates.join('<br>') || '—'}</td>
                    <td style="text-align: right;">
                        <div style="display: flex; gap: 4px; justify-content: flex-end;">
                            ${p.status === 'pending' ? `<button class="btn btn-small" onclick="approvePayment('${p.id}')" title="Approve" style="background: var(--blue-dim); color: var(--blue);">✓</button>` : ''}
                            ${p.status === 'approved' ? `<button class="btn btn-small btn-success" onclick="markPaymentPaid('${p.id}')" title="Mark Paid">✅</button>` : ''}
                            ${p.status === 'pending' ? `<button class="btn btn-small" onclick="rejectPayment('${p.id}')" title="Reject" style="background: var(--danger-dim); color: var(--danger);">❌</button>` : ''}
                            <button class="btn btn-small" onclick="editPayment('${p.id}')" title="Edit">✏️</button>
                            <button class="btn btn-small" onclick="deletePayment('${p.id}')" title="Delete" style="background: var(--danger-dim); color: var(--danger);">🗑️</button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }

        async function populatePaymentsPeriodFilter() {
            try {
                const { data } = await supabaseClient
                    .from('creator_payments')
                    .select('period_month')
                    .order('period_month', { ascending: false });
                
                const periods = [...new Set((data || []).map(d => d.period_month).filter(Boolean))];
                
                // Add current and next month if not present
                const now = new Date();
                const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                if (!periods.includes(currentMonth)) periods.unshift(currentMonth);
                
                const select = document.getElementById('paymentsPeriodFilter');
                const currentValue = select.value;
                
                select.innerHTML = '<option value="">All Periods</option>' + 
                    periods.map(p => {
                        const [year, month] = p.split('-');
                        const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                        return `<option value="${p}" ${p === currentValue ? 'selected' : ''}>${monthName}</option>`;
                    }).join('');
            } catch (err) {
                console.error('Failed to load payment periods:', err);
            }
        }

        async function loadRetainerCreators() {
            const container = document.getElementById('retainerCreatorsList');
            if (!container) {
                console.warn('retainerCreatorsList container not found');
                return;
            }
            
            try {
                // Fetch creators with retainers including identity info
                const { data, error } = await supabaseClient
                    .from('managed_creators')
                    .select('account_1, brand, retainer, discord_name, real_name');
                
                if (error) {
                    console.error('Supabase query error:', error);
                    container.innerHTML = '<div style="color: var(--text-muted);">Could not load retainer data</div>';
                    return;
                }
                
                // Filter for those with retainers
                const withRetainers = (data || []).filter(c => c.account_1 && c.retainer && parseFloat(c.retainer) > 0);
                
                if (withRetainers.length === 0) {
                    container.innerHTML = '<div style="color: var(--text-muted);">No creators on retainer found. Add retainer amounts in the Roster.</div>';
                    return;
                }
                
                // Group by identity (discord_name) like the roster does
                const identityMap = new Map();
                withRetainers.forEach(c => {
                    const key = (c.discord_name || c.account_1 || '').toLowerCase().trim();
                    if (!identityMap.has(key)) {
                        identityMap.set(key, {
                            displayName: c.real_name || c.discord_name || c.account_1,
                            retainers: [] // {brand, amount, account}
                        });
                    }
                    identityMap.get(key).retainers.push({
                        brand: c.brand,
                        amount: parseFloat(c.retainer),
                        account: c.account_1
                    });
                });
                
                // Convert to array and sort by total retainer amount
                const grouped = [...identityMap.values()]
                    .map(g => ({
                        ...g,
                        totalRetainer: g.retainers.reduce((sum, r) => sum + r.amount, 0)
                    }))
                    .sort((a, b) => a.displayName.localeCompare(b.displayName)); // Sort alphabetically by name
                
                // Render as a clean table layout
                container.innerHTML = `
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border); text-align: left;">
                                <th style="padding: 8px 12px; color: var(--text-muted); font-weight: 500;">Creator</th>
                                <th style="padding: 8px 12px; color: var(--text-muted); font-weight: 500;">Brand</th>
                                <th style="padding: 8px 12px; color: var(--text-muted); font-weight: 500; text-align: right;">Amount</th>
                                <th style="padding: 8px 12px; width: 80px;"></th>
                            </tr>
                        </thead>
                        <tbody id="quickClaimTableBody">
                            ${grouped.flatMap(creator => 
                                creator.retainers.map((r, idx) => `
                                    <tr class="quick-claim-row" data-name="${creator.displayName.toLowerCase()}" data-brand="${r.brand}" style="border-bottom: 1px solid var(--border);">
                                        <td style="padding: 10px 12px; font-weight: ${idx === 0 ? '600' : '400'};">
                                            ${idx === 0 ? creator.displayName : '<span style="color: var(--text-muted);">↳</span>'}
                                        </td>
                                        <td style="padding: 10px 12px;">
                                            <span class="badge-brand" style="font-size: 0.75rem;">${BRAND_DISPLAY[r.brand] || r.brand}</span>
                                        </td>
                                        <td style="padding: 10px 12px; text-align: right; color: var(--success); font-weight: 500;">
                                            ${fmtMoney(r.amount)}
                                        </td>
                                        <td style="padding: 10px 12px; text-align: right;">
                                            <button class="btn btn-sm btn-primary" 
                                                onclick="quickAddRetainer('${creator.displayName.replace(/'/g, "\\'")}', '${r.account}', '${r.brand}', ${r.amount})"
                                                style="padding: 4px 12px; font-size: 0.8rem;">
                                                + Claim
                                            </button>
                                        </td>
                                    </tr>
                                `)
                            ).join('')}
                        </tbody>
                    </table>
                    <div id="quickClaimSummary" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; color: var(--text-muted); font-size: 0.85rem;">
                        <span>${grouped.length} creators on retainer</span>
                        <span>Total: <strong style="color: var(--success);">${fmtMoney(grouped.reduce((s, c) => s + c.totalRetainer, 0))}/mo</strong></span>
                    </div>
                `;
                
            } catch (err) {
                console.error('Failed to load retainer creators:', err);
                container.innerHTML = '<div style="color: var(--text-muted);">Could not load retainer data</div>';
            }
        }

        function quickAddRetainer(displayName, account, brand, amount) {
            document.getElementById('addPaymentCreator').value = displayName;
            document.getElementById('addPaymentBrand').value = brand;
            document.getElementById('addPaymentType').value = 'retainer';
            document.getElementById('addPaymentAmount').value = amount;
            
            // Set period to current month
            const now = new Date();
            document.getElementById('addPaymentPeriod').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            openAddPaymentModal();
        }
        
        function filterQuickClaimTable() {
            const search = (document.getElementById('quickClaimSearch')?.value || '').toLowerCase().trim();
            const rows = document.querySelectorAll('.quick-claim-row');
            let visibleCount = 0;
            
            rows.forEach(row => {
                const name = row.dataset.name || '';
                const brand = row.dataset.brand || '';
                const matches = !search || name.includes(search) || (BRAND_DISPLAY[brand] || brand).toLowerCase().includes(search);
                row.style.display = matches ? '' : 'none';
                if (matches) visibleCount++;
            });
            
            // Update visible count in summary
            const summary = document.getElementById('quickClaimSummary');
            if (summary && search) {
                const totalCreators = document.querySelectorAll('.quick-claim-row').length;
                summary.querySelector('span').textContent = `Showing ${visibleCount} of ${totalCreators} creators`;
            }
        }

        function setPaymentsStatusFilter(status) {
            paymentsStatusFilter = status;
            
            // Update button styles
            document.querySelectorAll('[id^="filter"]').forEach(btn => {
                btn.classList.remove('btn-primary');
            });
            const activeBtn = document.getElementById('filter' + status.charAt(0).toUpperCase() + status.slice(1));
            if (activeBtn) activeBtn.classList.add('btn-primary');
            
            loadPaymentsView();
        }

        function filterPaymentsTable() {
            const search = document.getElementById('paymentsSearchInput').value.toLowerCase();
            const filtered = allPaymentsData.filter(p => 
                p.creator_name.toLowerCase().includes(search) ||
                (p.notes && p.notes.toLowerCase().includes(search))
            );
            renderPaymentsTable(filtered);
        }

        function togglePaymentSelect(id) {
            if (selectedPaymentIds.has(id)) {
                selectedPaymentIds.delete(id);
            } else {
                selectedPaymentIds.add(id);
            }
        }

        function toggleAllPayments(checkbox) {
            const checkboxes = document.querySelectorAll('.payment-check');
            checkboxes.forEach(cb => {
                cb.checked = checkbox.checked;
                if (checkbox.checked) {
                    selectedPaymentIds.add(cb.dataset.id);
                } else {
                    selectedPaymentIds.delete(cb.dataset.id);
                }
            });
        }

        async function bulkApproveSelected() {
            if (selectedPaymentIds.size === 0) {
                showToast('No payments selected', 'warning');
                return;
            }
            
            try {
                const { error } = await supabaseClient
                    .from('creator_payments')
                    .update({ 
                        status: 'approved', 
                        date_approved: new Date().toISOString().split('T')[0],
                        updated_at: new Date().toISOString()
                    })
                    .in('id', Array.from(selectedPaymentIds))
                    .eq('status', 'pending');
                
                if (error) throw error;
                
                showToast(`Approved ${selectedPaymentIds.size} payments`, 'success');
                selectedPaymentIds.clear();
                loadPaymentsView();
            } catch (err) {
                console.error('Failed to bulk approve:', err);
                showToast('Failed to approve payments', 'error');
            }
        }

        async function bulkMarkPaidSelected() {
            if (selectedPaymentIds.size === 0) {
                showToast('No payments selected', 'warning');
                return;
            }
            
            try {
                const { error } = await supabaseClient
                    .from('creator_payments')
                    .update({ 
                        status: 'paid', 
                        date_paid: new Date().toISOString().split('T')[0],
                        updated_at: new Date().toISOString()
                    })
                    .in('id', Array.from(selectedPaymentIds));
                
                if (error) throw error;
                
                showToast(`Marked ${selectedPaymentIds.size} payments as paid`, 'success');
                selectedPaymentIds.clear();
                loadPaymentsView();
            } catch (err) {
                console.error('Failed to bulk mark paid:', err);
                showToast('Failed to update payments', 'error');
            }
        }

        async function approvePayment(id) {
            try {
                const { error } = await supabaseClient
                    .from('creator_payments')
                    .update({ 
                        status: 'approved', 
                        date_approved: new Date().toISOString().split('T')[0],
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);
                
                if (error) throw error;
                showToast('Payment approved', 'success');
                loadPaymentsView();
            } catch (err) {
                console.error('Failed to approve:', err);
                showToast('Failed to approve payment', 'error');
            }
        }

        async function markPaymentPaid(id) {
            try {
                const { error } = await supabaseClient
                    .from('creator_payments')
                    .update({ 
                        status: 'paid', 
                        date_paid: new Date().toISOString().split('T')[0],
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);
                
                if (error) throw error;
                showToast('Payment marked as paid', 'success');
                loadPaymentsView();
            } catch (err) {
                console.error('Failed to mark paid:', err);
                showToast('Failed to update payment', 'error');
            }
        }

        async function rejectPayment(id) {
            if (!confirm('Reject this payment claim?')) return;
            
            try {
                const { error } = await supabaseClient
                    .from('creator_payments')
                    .update({ 
                        status: 'rejected',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id);
                
                if (error) throw error;
                showToast('Payment rejected', 'warning');
                loadPaymentsView();
            } catch (err) {
                console.error('Failed to reject:', err);
                showToast('Failed to reject payment', 'error');
            }
        }

        async function deletePayment(id) {
            if (!confirm('Delete this payment record? This cannot be undone.')) return;
            
            try {
                const { error } = await supabaseClient
                    .from('creator_payments')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
                showToast('Payment deleted', 'success');
                loadPaymentsView();
            } catch (err) {
                console.error('Failed to delete:', err);
                showToast('Failed to delete payment', 'error');
            }
        }

        let editingPaymentId = null;
        
        async function editPayment(id) {
            try {
                const { data, error } = await supabaseClient
                    .from('creator_payments')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (error) throw error;
                
                editingPaymentId = id;
                
                // Populate edit form
                document.getElementById('editPaymentCreator').value = data.creator_name || '';
                document.getElementById('editPaymentBrand').value = data.brand || '';
                document.getElementById('editPaymentType').value = data.payment_type || 'retainer';
                document.getElementById('editPaymentAmount').value = data.amount || '';
                document.getElementById('editPaymentPeriod').value = data.period_month || '';
                document.getElementById('editPaymentStatus').value = data.status || 'pending';
                document.getElementById('editPaymentNotes').value = data.notes || '';
                
                document.getElementById('editPaymentModal').classList.add('show');
            } catch (err) {
                console.error('Failed to load payment:', err);
                showToast('Failed to load payment details', 'error');
            }
        }
        
        function closeEditPaymentModal() {
            document.getElementById('editPaymentModal').classList.remove('show');
            editingPaymentId = null;
        }
        
        async function submitEditPayment() {
            if (!editingPaymentId) return;
            
            const creatorName = document.getElementById('editPaymentCreator').value.trim();
            const brand = document.getElementById('editPaymentBrand').value;
            const paymentType = document.getElementById('editPaymentType').value;
            const amount = parseFloat(document.getElementById('editPaymentAmount').value);
            const periodMonth = document.getElementById('editPaymentPeriod').value;
            const status = document.getElementById('editPaymentStatus').value;
            const notes = document.getElementById('editPaymentNotes').value.trim();
            
            if (!creatorName || !brand || !amount || !periodMonth) {
                showToast('Please fill in all required fields', 'error');
                return;
            }
            
            try {
                const updateData = {
                    creator_name: creatorName,
                    brand: brand,
                    payment_type: paymentType,
                    amount: amount,
                    period_month: periodMonth,
                    status: status,
                    notes: notes || null,
                    updated_at: new Date().toISOString()
                };
                
                // Update date fields based on status
                if (status === 'approved') {
                    updateData.date_approved = updateData.date_approved || new Date().toISOString().split('T')[0];
                }
                if (status === 'paid') {
                    updateData.date_paid = updateData.date_paid || new Date().toISOString().split('T')[0];
                }
                
                const { error } = await supabaseClient
                    .from('creator_payments')
                    .update(updateData)
                    .eq('id', editingPaymentId);
                
                if (error) throw error;
                
                showToast('Payment updated', 'success');
                closeEditPaymentModal();
                loadPaymentsView();
            } catch (err) {
                console.error('Failed to update payment:', err);
                showToast('Failed to update payment', 'error');
            }
        }

        // Add Payment Modal
        function openAddPaymentModal() {
            // Set default period to current month
            const now = new Date();
            document.getElementById('addPaymentPeriod').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            // Load creator suggestions
            loadCreatorSuggestions();
            
            document.getElementById('addPaymentModal').classList.add('show');
        }

        function closeAddPaymentModal() {
            document.getElementById('addPaymentModal').classList.remove('show');
            // Clear form
            document.getElementById('addPaymentCreator').value = '';
            document.getElementById('addPaymentAmount').value = '';
            document.getElementById('addPaymentNotes').value = '';
        }

        async function loadCreatorSuggestions() {
            try {
                const { data } = await supabaseClient
                    .from('managed_creators')
                    .select('account_1')
                    .order('account_1');
                
                const datalist = document.getElementById('creatorSuggestions');
                datalist.innerHTML = (data || []).filter(c => c.account_1).map(c => `<option value="${c.account_1}">`).join('');
            } catch (err) {
                console.error('Failed to load creator suggestions:', err);
            }
        }

        async function submitAddPayment() {
            const creatorName = document.getElementById('addPaymentCreator').value.trim().replace('@', '');
            const brand = document.getElementById('addPaymentBrand').value;
            const paymentType = document.getElementById('addPaymentType').value;
            const amount = parseFloat(document.getElementById('addPaymentAmount').value);
            const periodMonth = document.getElementById('addPaymentPeriod').value;
            const notes = document.getElementById('addPaymentNotes').value.trim();
            
            if (!creatorName || !amount || !periodMonth) {
                showToast('Please fill in all required fields', 'warning');
                return;
            }
            
            try {
                const { error } = await supabaseClient
                    .from('creator_payments')
                    .insert({
                        creator_name: creatorName,
                        brand: brand,
                        payment_type: paymentType,
                        amount: amount,
                        period_month: periodMonth,
                        date_submitted: new Date().toISOString().split('T')[0],
                        status: 'pending',
                        notes: notes || null
                    });
                
                if (error) throw error;
                
                showToast('Payment record added!', 'success');
                closeAddPaymentModal();
                loadPaymentsView();
            } catch (err) {
                console.error('Failed to add payment:', err);
                showToast('Failed to add payment: ' + err.message, 'error');
            }
        }

        // ==================== 1% COMMISSIONS CALCULATOR ====================
        let commissionsData = [];
        let commissionsBaselineRates = {};
        let currentCommissionsBrand = null;
        let currentCommissionsPeriod = null;
        let commissionsSortColumn = 'commission';
        let commissionsSortAsc = false;
        
        async function loadCommissionsData() {
            // Load baseline rates
            await loadBaselineRates();
            // Load history if on history tab
            if (document.getElementById('commissions-history')?.style.display !== 'none') {
                loadCommissionsHistory();
            }
        }
        
        async function loadBaselineRates() {
            try {
                const { data, error } = await supabaseClient
                    .from('product_commission_rates')
                    .select('*')
                    .order('brand');
                
                if (error) throw error;
                
                // Organize by brand -> product_id
                commissionsBaselineRates = {};
                (data || []).forEach(rate => {
                    if (!commissionsBaselineRates[rate.brand]) {
                        commissionsBaselineRates[rate.brand] = {};
                    }
                    const key = rate.product_id || '_default';
                    commissionsBaselineRates[rate.brand][key] = {
                        standard: parseFloat(rate.standard_commission_baseline) || 25,
                        shopAds: parseFloat(rate.shop_ads_commission_baseline) || 15
                    };
                });
                
                console.log('Loaded baseline rates:', commissionsBaselineRates);
            } catch (err) {
                console.error('Error loading baseline rates:', err);
                // Set defaults if table doesn't exist
                commissionsBaselineRates = {
                    'jiyu': { '_default': { standard: 25, shopAds: 15 } },
                    'catakor': { '_default': { standard: 25, shopAds: 15 } },
                    'physicians_choice': { '_default': { standard: 20, shopAds: 15 } },
                    'peach_slices': { '_default': { standard: 20, shopAds: 15 } },
                    'yerba_magic': { '_default': { standard: 25, shopAds: 15 } }
                };
            }
        }
        
        function switchCommissionsTab(tab) {
            document.getElementById('commTabCalculator').classList.toggle('active', tab === 'calculator');
            document.getElementById('commTabHistory').classList.toggle('active', tab === 'history');
            document.getElementById('commissions-calculator').style.display = tab === 'calculator' ? 'block' : 'none';
            document.getElementById('commissions-history').style.display = tab === 'history' ? 'block' : 'none';
            
            if (tab === 'history') {
                loadCommissionsHistory();
            }
        }
        
        function showUploadCommissionsModal() {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay show';
            modal.id = 'uploadCommissionsModal';
            modal.innerHTML = `
                <div class="modal" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 class="modal-title">📤 Upload Affiliate Orders</h3>
                        <button class="modal-close" onclick="closeUploadCommissionsModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Brand</label>
                            <select id="uploadCommBrand" class="form-control" required>
                                <option value="">Select Brand...</option>
                                <option value="jiyu">JiYu</option>
                                <option value="catakor">Cata-Kor</option>
                                <option value="physicians_choice">Physicians Choice</option>
                                <option value="peach_slices">Peach Slices</option>
                                <option value="yerba_magic">Yerba Magic</option>
                            <option value="toplux">Toplux Nutrition</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Period (Month)</label>
                            <input type="month" id="uploadCommPeriod" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>Affiliate Orders CSV</label>
                            <input type="file" id="uploadCommFile" accept=".csv" class="form-control" required>
                            <small style="color: var(--text-muted);">File from TikTok Shop: creator_order_all_*.csv</small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeUploadCommissionsModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="processCommissionsFile()">🧮 Calculate</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Set default period to last month
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            document.getElementById('uploadCommPeriod').value = lastMonth.toISOString().slice(0, 7);
        }
        
        function closeUploadCommissionsModal() {
            document.getElementById('uploadCommissionsModal')?.remove();
        }
        
        async function processCommissionsFile() {
            const brand = document.getElementById('uploadCommBrand').value;
            const period = document.getElementById('uploadCommPeriod').value;
            const fileInput = document.getElementById('uploadCommFile');
            
            if (!brand || !period || !fileInput.files[0]) {
                showToast('Please fill in all fields', 'error');
                return;
            }
            
            currentCommissionsBrand = brand;
            currentCommissionsPeriod = period;
            
            showLoading('commissions', 'Processing affiliate orders...');
            closeUploadCommissionsModal();
            
            try {
                const file = fileInput.files[0];
                const text = await file.text();
                const rows = parseCSV(text);
                
                console.log(`Parsed ${rows.length} rows from CSV`);
                if (rows.length > 0) {
                    console.log('Sample row:', rows[0]);
                }
                
                // Get baseline rates for this brand
                const brandRates = commissionsBaselineRates[brand] || { '_default': { standard: 25, shopAds: 15 } };
                const defaultRates = brandRates['_default'] || { standard: 25, shopAds: 15 };
                console.log('Using baseline rates:', defaultRates);
                
                // Process each row
                const creatorTotals = {};
                let processedRows = 0;
                let completedOrProcessing = 0;
                let hasCreatorName = 0;
                let has1PctRate = 0;
                
                rows.forEach(row => {
                    const orderStatus = row['Order Status'];
                    if (orderStatus !== 'Completed' && orderStatus !== 'Processing') return;
                    completedOrProcessing++;
                    
                    const creatorName = (row['Creator Username'] || '').toLowerCase();
                    if (!creatorName) return;
                    hasCreatorName++;
                    
                    const standardRate = parseFloat(row['Standard commission rate']) || 0;
                    const shopAdsRate = parseFloat(row['Shop Ads commission rate']) || 0;
                    const estCommissionBase = parseFloat(row['Est. Commission Base']) || 0;
                    const productId = row['Product ID'] || '';
                    
                    // Check if either rate is 1%
                    if (standardRate !== 1 && shopAdsRate !== 1) return;
                    has1PctRate++;
                    
                    // Get rates for this product (or default)
                    const productRates = brandRates[productId] || defaultRates;
                    
                    // Initialize creator if needed
                    if (!creatorTotals[creatorName]) {
                        creatorTotals[creatorName] = {
                            creator: creatorName,
                            brand: brand,
                            orders: 0,
                            standardGmv: 0,
                            shopAdsGmv: 0,
                            standardCommission: 0,
                            shopAdsCommission: 0,
                            totalCommission: 0
                        };
                    }
                    
                    const c = creatorTotals[creatorName];
                    c.orders++;
                    processedRows++;
                    
                    // Calculate standard commission (if rate = 1)
                    if (standardRate === 1) {
                        c.standardGmv += estCommissionBase;
                        const commissionPct = (productRates.standard - 1) / 100;
                        c.standardCommission += estCommissionBase * commissionPct;
                    }
                    
                    // Calculate shop ads commission (if rate = 1)
                    if (shopAdsRate === 1) {
                        c.shopAdsGmv += estCommissionBase;
                        const commissionPct = (productRates.shopAds - 1) / 100;
                        c.shopAdsCommission += estCommissionBase * commissionPct;
                    }
                    
                    c.totalCommission = c.standardCommission + c.shopAdsCommission;
                });
                
                // Convert to array and sort
                commissionsData = Object.values(creatorTotals).sort((a, b) => b.totalCommission - a.totalCommission);
                
                console.log('=== COMMISSION PROCESSING SUMMARY ===');
                console.log(`Total rows: ${rows.length}`);
                console.log(`Completed/Processing: ${completedOrProcessing}`);
                console.log(`With creator name: ${hasCreatorName}`);
                console.log(`With 1% rate: ${has1PctRate}`);
                console.log(`Final qualifying rows: ${processedRows}`);
                console.log(`Unique creators: ${commissionsData.length}`);
                
                if (commissionsData.length === 0) {
                    hideLoading('commissions');
                    showToast(`No creators found with 1% commission rate.\n\nCompleted/Processing orders: ${completedOrProcessing}\nWith 1% rate: ${has1PctRate}`, 'warning');
                    return;
                }
                
                // Update UI
                renderCommissionsResults();
                
                const totalComm = commissionsData.reduce((sum, c) => sum + c.totalCommission, 0);
                showToast(`Found ${commissionsData.length} creators with $${totalComm.toFixed(2)} total commission`, 'success');
                
            } catch (err) {
                console.error('Error processing commissions file:', err);
                showToast('Error processing file: ' + err.message, 'error');
            } finally {
                hideLoading('commissions');
            }
        }
        
        function parseCSV(text) {
            const lines = text.split('\n');
            if (lines.length < 2) return [];
            
            // Parse header
            const headers = parseCSVLine(lines[0]);
            
            // Parse rows
            const rows = [];
            for (let i = 1; i < lines.length; i++) {
                if (!lines[i].trim()) continue;
                const values = parseCSVLine(lines[i]);
                const row = {};
                headers.forEach((h, idx) => {
                    row[h] = values[idx] || '';
                });
                rows.push(row);
            }
            return rows;
        }
        
        function parseCSVLine(line) {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        }
        
        function renderCommissionsResults() {
            // Show results section
            document.getElementById('commissionsUploadArea').style.display = 'none';
            document.getElementById('commissionsResults').style.display = 'block';
            
            // Update summary
            const totalGmv = commissionsData.reduce((sum, c) => sum + c.standardGmv + c.shopAdsGmv, 0);
            const totalCommission = commissionsData.reduce((sum, c) => sum + c.totalCommission, 0);
            
            document.getElementById('commPeriod').textContent = formatPeriod(currentCommissionsPeriod) + ' • ' + BRAND_DISPLAY[currentCommissionsBrand];
            document.getElementById('commCreatorCount').textContent = commissionsData.length;
            document.getElementById('commTotalGmv').textContent = '$' + totalGmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('commTotalCommission').textContent = '$' + totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            
            renderCommissionsTable();
        }
        
        function renderCommissionsTable() {
            const tbody = document.getElementById('commissionsTableBody');
            const tfoot = document.getElementById('commissionsTableFoot');
            
            // Apply filters
            const searchTerm = (document.getElementById('commSearchInput')?.value || '').toLowerCase();
            let filtered = commissionsData.filter(c => 
                c.creator.toLowerCase().includes(searchTerm)
            );
            
            // Sort
            filtered.sort((a, b) => {
                let aVal, bVal;
                switch (commissionsSortColumn) {
                    case 'creator': aVal = a.creator; bVal = b.creator; break;
                    case 'orders': aVal = a.orders; bVal = b.orders; break;
                    case 'standardGmv': aVal = a.standardGmv; bVal = b.standardGmv; break;
                    case 'shopAdsGmv': aVal = a.shopAdsGmv; bVal = b.shopAdsGmv; break;
                    case 'commission': aVal = a.totalCommission; bVal = b.totalCommission; break;
                    default: aVal = a.totalCommission; bVal = b.totalCommission;
                }
                if (typeof aVal === 'string') {
                    return commissionsSortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }
                return commissionsSortAsc ? aVal - bVal : bVal - aVal;
            });
            
            if (filtered.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No results found</td></tr>';
                tfoot.style.display = 'none';
                return;
            }
            
            tbody.innerHTML = filtered.map(c => `
                <tr>
                    <td><a href="https://tiktok.com/@${c.creator}" target="_blank" style="color: var(--accent); text-decoration: none;">@${c.creator}</a></td>
                    <td>${BRAND_DISPLAY[c.brand] || c.brand}</td>
                    <td style="text-align: right;">${c.orders.toLocaleString()}</td>
                    <td style="text-align: right;">$${c.standardGmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="text-align: right;">$${c.shopAdsGmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">$${c.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
            `).join('');
            
            // Update footer totals
            const totalOrders = filtered.reduce((sum, c) => sum + c.orders, 0);
            const totalStandardGmv = filtered.reduce((sum, c) => sum + c.standardGmv, 0);
            const totalShopAdsGmv = filtered.reduce((sum, c) => sum + c.shopAdsGmv, 0);
            const totalCommission = filtered.reduce((sum, c) => sum + c.totalCommission, 0);
            
            document.getElementById('commFootOrders').textContent = totalOrders.toLocaleString();
            document.getElementById('commFootStandardGmv').textContent = '$' + totalStandardGmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('commFootShopAdsGmv').textContent = '$' + totalShopAdsGmv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            document.getElementById('commFootCommission').textContent = '$' + totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            tfoot.style.display = 'table-footer-group';
        }
        
        function filterCommissionsTable() {
            renderCommissionsTable();
        }
        
        function sortCommissionsTable(column) {
            if (commissionsSortColumn === column) {
                commissionsSortAsc = !commissionsSortAsc;
            } else {
                commissionsSortColumn = column;
                commissionsSortAsc = false;
            }
            renderCommissionsTable();
        }
        
        function formatPeriod(period) {
            if (!period) return '-';
            const [year, month] = period.split('-');
            const date = new Date(year, parseInt(month) - 1, 1);
            return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        
        function exportCommissionsCSV() {
            if (commissionsData.length === 0) {
                showToast('No data to export', 'warning');
                return;
            }
            
            const headers = ['Creator', 'Brand', 'Orders', 'Standard GMV', 'Shop Ads GMV', 'Standard Commission', 'Shop Ads Commission', 'Total Commission'];
            const rows = commissionsData.map(c => [
                c.creator,
                c.brand,
                c.orders,
                c.standardGmv.toFixed(2),
                c.shopAdsGmv.toFixed(2),
                c.standardCommission.toFixed(2),
                c.shopAdsCommission.toFixed(2),
                c.totalCommission.toFixed(2)
            ]);
            
            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `commissions_${currentCommissionsBrand}_${currentCommissionsPeriod}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            showToast('CSV exported!', 'success');
        }
        
        async function saveCommissionsToDatabase() {
            if (commissionsData.length === 0) {
                showToast('No data to save', 'warning');
                return;
            }
            
            if (!confirm(`Save ${commissionsData.length} commission records for ${formatPeriod(currentCommissionsPeriod)}?`)) return;
            
            showLoading('commissions', 'Saving to database...');
            
            try {
                // Prepare records
                const records = commissionsData.map(c => ({
                    brand: c.brand,
                    period_month: currentCommissionsPeriod,
                    creator_name: c.creator,
                    total_orders: c.orders,
                    completed_orders: c.orders,
                    standard_gmv: c.standardGmv,
                    shop_ads_gmv: c.shopAdsGmv,
                    standard_commission: c.standardCommission,
                    shop_ads_commission: c.shopAdsCommission,
                    total_commission: c.totalCommission,
                    is_managed: false,  // Not filtered by roster
                    calculated_at: new Date().toISOString()
                }));
                
                // Upsert records (update if exists)
                const { error } = await supabaseClient
                    .from('creator_commissions')
                    .upsert(records, { 
                        onConflict: 'brand,period_month,creator_name',
                        ignoreDuplicates: false 
                    });
                
                if (error) throw error;
                
                // Log the upload
                const totalCommission = commissionsData.reduce((sum, c) => sum + c.totalCommission, 0);
                await supabaseClient.from('commission_uploads').insert({
                    brand: currentCommissionsBrand,
                    period_month: currentCommissionsPeriod,
                    total_creators: commissionsData.length,
                    managed_creators: commissionsData.length,
                    total_commission: totalCommission,
                    uploaded_at: new Date().toISOString()
                });
                
                showToast(`Saved ${records.length} commission records!`, 'success');
                
            } catch (err) {
                console.error('Error saving commissions:', err);
                showToast('Error saving: ' + err.message, 'error');
            } finally {
                hideLoading('commissions');
            }
        }
        
        async function loadCommissionsHistory() {
            const tbody = document.getElementById('commissionsHistoryBody');
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading...</td></tr>';
            
            try {
                const brandFilter = document.getElementById('historyBrandFilter')?.value || 'all';
                
                let query = supabaseClient
                    .from('creator_commissions')
                    .select('*')
                    .order('period_month', { ascending: false })
                    .order('total_commission', { ascending: false })
                    .limit(500);
                
                if (brandFilter !== 'all') {
                    query = query.eq('brand', brandFilter);
                }
                
                const { data, error } = await query;
                
                if (error) throw error;
                
                if (!data || data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No commission history found</td></tr>';
                    return;
                }
                
                // Populate period filter
                const periods = [...new Set(data.map(d => d.period_month))].sort().reverse();
                const periodSelect = document.getElementById('historyPeriodFilter');
                periodSelect.innerHTML = '<option value="all">All Periods</option>' + 
                    periods.map(p => `<option value="${p}">${formatPeriod(p)}</option>`).join('');
                
                // Filter by period if selected
                const periodFilter = periodSelect.value;
                let filtered = data;
                if (periodFilter !== 'all') {
                    filtered = data.filter(d => d.period_month === periodFilter);
                }
                
                tbody.innerHTML = filtered.map(d => `
                    <tr>
                        <td>${formatPeriod(d.period_month)}</td>
                        <td>${BRAND_DISPLAY[d.brand] || d.brand}</td>
                        <td><a href="https://tiktok.com/@${d.creator_name}" target="_blank" style="color: var(--accent);">@${d.creator_name}</a></td>
                        <td style="text-align: right;">${d.total_orders?.toLocaleString() || 0}</td>
                        <td style="text-align: right;">$${((d.standard_gmv || 0) + (d.shop_ads_gmv || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">$${(d.total_commission || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td style="text-align: right; font-size: 0.8rem; color: var(--text-muted);">${d.calculated_at ? new Date(d.calculated_at).toLocaleDateString() : '-'}</td>
                    </tr>
                `).join('');
                
            } catch (err) {
                console.error('Error loading commission history:', err);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">Error loading history</td></tr>';
            }
        }
        
        function showBaselineRatesModal() {
            const brands = ['jiyu', 'catakor', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            
            const modal = document.createElement('div');
            modal.className = 'modal-overlay show';
            modal.id = 'baselineRatesModal';
            modal.innerHTML = `
                <div class="modal" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 class="modal-title">⚙️ Baseline Commission Rates</h3>
                        <button class="modal-close" onclick="closeBaselineRatesModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="color: var(--text-muted); margin-bottom: 16px;">Set the default commission rates for each brand. These are used to calculate the 1% creator commissions.</p>
                        <table class="data-table" style="width: 100%;">
                            <thead>
                                <tr>
                                    <th>Brand</th>
                                    <th style="text-align: center;">Standard %</th>
                                    <th style="text-align: center;">Shop Ads %</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${brands.map(brand => {
                                    const rates = commissionsBaselineRates[brand]?.['_default'] || { standard: 25, shopAds: 15 };
                                    return `
                                        <tr>
                                            <td>${BRAND_DISPLAY[brand] || brand}</td>
                                            <td style="text-align: center;"><input type="number" id="rate_${brand}_standard" value="${rates.standard}" min="0" max="100" step="0.1" style="width: 70px; padding: 6px; text-align: center; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);">%</td>
                                            <td style="text-align: center;"><input type="number" id="rate_${brand}_shopads" value="${rates.shopAds}" min="0" max="100" step="0.1" style="width: 70px; padding: 6px; text-align: center; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-secondary); color: var(--text-primary);">%</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="closeBaselineRatesModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveBaselineRates()">💾 Save Rates</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        function closeBaselineRatesModal() {
            document.getElementById('baselineRatesModal')?.remove();
        }
        
        async function saveBaselineRates() {
            const brands = ['jiyu', 'catakor', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            
            try {
                for (const brand of brands) {
                    const standard = parseFloat(document.getElementById(`rate_${brand}_standard`).value) || 25;
                    const shopAds = parseFloat(document.getElementById(`rate_${brand}_shopads`).value) || 15;
                    
                    await supabaseClient
                        .from('product_commission_rates')
                        .upsert({
                            brand: brand,
                            product_id: null,
                            product_name: 'Brand Default',
                            standard_commission_baseline: standard,
                            shop_ads_commission_baseline: shopAds,
                            updated_at: new Date().toISOString()
                        }, { onConflict: 'brand,product_id' });
                    
                    // Update local cache
                    if (!commissionsBaselineRates[brand]) commissionsBaselineRates[brand] = {};
                    commissionsBaselineRates[brand]['_default'] = { standard, shopAds };
                }
                
                showToast('Baseline rates saved!', 'success');
                closeBaselineRatesModal();
                
            } catch (err) {
                console.error('Error saving baseline rates:', err);
                showToast('Error saving rates: ' + err.message, 'error');
            }
        }

        // ==================== MONTHLY PERFORMANCE REPORT ====================
        function openMonthlyReportModal() {
            // Populate month selector
            const monthSelect = document.getElementById('reportMonth');
            const now = new Date();
            const months = [];
            
            for (let i = 0; i < 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                months.push({ value, label });
            }
            
            monthSelect.innerHTML = months.map((m, i) => 
                `<option value="${m.value}" ${i === 1 ? 'selected' : ''}>${m.label}</option>`
            ).join('');
            
            document.getElementById('monthlyReportModal').classList.add('show');
        }

        function closeMonthlyReportModal() {
            document.getElementById('monthlyReportModal').classList.remove('show');
        }

        async function generateMonthlyReport() {
            const brand = document.getElementById('reportBrand').value;
            const monthValue = document.getElementById('reportMonth').value;
            const [year, month] = monthValue.split('-');
            const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            const preview = document.getElementById('monthlyReportPreview');
            preview.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">Generating report...</div>';
            
            try {
                // 1. Get performance data (GMV, orders) for the month
                const startDate = `${monthValue}-01`;
                const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
                
                const { data: perfData, error: perfError } = await supabaseClient
                    .from('creator_performance')
                    .select('*')
                    .eq('brand', brand)
                    .gte('report_date', startDate)
                    .lte('report_date', endDate);
                
                if (perfError) throw perfError;
                
                // Aggregate by creator
                const creatorStats = {};
                let totalGmv = 0, totalOrders = 0;
                
                (perfData || []).forEach(row => {
                    const name = row.creator_name;
                    if (!creatorStats[name]) {
                        creatorStats[name] = { gmv: 0, orders: 0 };
                    }
                    creatorStats[name].gmv += parseFloat(row.gmv) || 0;
                    creatorStats[name].orders += parseInt(row.orders) || 0;
                    totalGmv += parseFloat(row.gmv) || 0;
                    totalOrders += parseInt(row.orders) || 0;
                });
                
                const creatorList = Object.entries(creatorStats)
                    .map(([name, stats]) => ({ name, ...stats }))
                    .sort((a, b) => b.gmv - a.gmv);
                
                // 2. Get payments data for the month (retainers, top-ups paid)
                const { data: paymentsData, error: paymentsError } = await supabaseClient
                    .from('creator_payments')
                    .select('*')
                    .eq('brand', brand)
                    .eq('period_month', monthValue)
                    .eq('status', 'paid');
                
                if (paymentsError) throw paymentsError;
                
                let totalRetainersPaid = 0, totalTopUpsPaid = 0, totalBonusesPaid = 0;
                const paidRetainers = [];
                const paidTopUps = [];
                
                (paymentsData || []).forEach(p => {
                    const amt = parseFloat(p.amount) || 0;
                    if (p.payment_type === 'retainer') {
                        totalRetainersPaid += amt;
                        paidRetainers.push({ name: p.creator_name, amount: amt });
                    } else if (p.payment_type === 'commission_topup') {
                        totalTopUpsPaid += amt;
                        paidTopUps.push({ name: p.creator_name, amount: amt });
                    } else if (p.payment_type === 'bonus') {
                        totalBonusesPaid += amt;
                    }
                });
                
                // 3. Calculate creator commissions (what TikTok pays creators)
                // Assuming average 10% commission to creators on GMV
                const avgCreatorCommissionRate = 0.10;
                const estimatedCreatorCommissions = totalGmv * avgCreatorCommissionRate;
                
                // 4. Get CC fees from calculator data (stored rates/retainers)
                const brandRate = parseFloat(localStorage.getItem(`rate_${brand}`)) || 2;
                const ccRetainer = parseFloat(localStorage.getItem(`retainer_${brand}`)) || 0;
                const ccCommission = totalGmv * (brandRate / 100);
                const ccTotal = ccCommission + ccRetainer;
                
                // 5. Calculate totals
                const totalBrandSpend = estimatedCreatorCommissions + totalRetainersPaid + totalTopUpsPaid + totalBonusesPaid + ccTotal;
                const roi = totalBrandSpend > 0 ? (totalGmv / totalBrandSpend) : 0;
                const costPerOrder = totalOrders > 0 ? (totalBrandSpend / totalOrders) : 0;
                
                // Generate HTML
                preview.innerHTML = `
                    <div style="padding: 40px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        <!-- Header -->
                        <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb;">
                            <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Monthly Performance & ROI Report</div>
                            <div style="font-size: 28px; font-weight: 700; color: #1a1a1a; margin: 8px 0;">${BRAND_DISPLAY[brand] || brand}</div>
                            <div style="font-size: 16px; color: #666;">${monthName}</div>
                        </div>
                        
                        <!-- Executive Summary -->
                        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; padding: 24px; margin-bottom: 30px;">
                            <div style="font-size: 14px; font-weight: 600; color: #166534; margin-bottom: 16px;">📊 Executive Summary</div>
                            <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; text-align: center;">
                                <div>
                                    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">Total GMV</div>
                                    <div style="font-size: 22px; font-weight: 700; color: #1a1a1a;">$${totalGmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">Total Orders</div>
                                    <div style="font-size: 22px; font-weight: 700; color: #1a1a1a;">${totalOrders.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">Brand Spend</div>
                                    <div style="font-size: 22px; font-weight: 700; color: #dc2626;">$${totalBrandSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                <div style="background: white; border-radius: 8px; padding: 8px;">
                                    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">ROI</div>
                                    <div style="font-size: 22px; font-weight: 700; color: #16a34a;">${roi.toFixed(1)}x</div>
                                </div>
                                <div>
                                    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">Cost/Order</div>
                                    <div style="font-size: 22px; font-weight: 700; color: #1a1a1a;">$${costPerOrder.toFixed(2)}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Spend Breakdown -->
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px;">💰 Brand Spend Breakdown</div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <thead>
                                    <tr style="background: #f8f9fa;">
                                        <th style="text-align: left; padding: 10px 12px; color: #666;">Category</th>
                                        <th style="text-align: right; padding: 10px 12px; color: #666;">Amount</th>
                                        <th style="text-align: right; padding: 10px 12px; color: #666;">% of Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 10px 12px;">Creator Commissions (est. 10% of GMV)</td>
                                        <td style="text-align: right; padding: 10px 12px;">$${estimatedCreatorCommissions.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style="text-align: right; padding: 10px 12px; color: #666;">${totalBrandSpend > 0 ? ((estimatedCreatorCommissions / totalBrandSpend) * 100).toFixed(1) : 0}%</td>
                                    </tr>
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 10px 12px;">Creator Retainers Paid (${paidRetainers.length} creators)</td>
                                        <td style="text-align: right; padding: 10px 12px;">$${totalRetainersPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style="text-align: right; padding: 10px 12px; color: #666;">${totalBrandSpend > 0 ? ((totalRetainersPaid / totalBrandSpend) * 100).toFixed(1) : 0}%</td>
                                    </tr>
                                    ${totalTopUpsPaid > 0 ? `
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 10px 12px;">Commission Top-Ups (${paidTopUps.length} creators)</td>
                                        <td style="text-align: right; padding: 10px 12px;">$${totalTopUpsPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style="text-align: right; padding: 10px 12px; color: #666;">${((totalTopUpsPaid / totalBrandSpend) * 100).toFixed(1)}%</td>
                                    </tr>
                                    ` : ''}
                                    ${totalBonusesPaid > 0 ? `
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 10px 12px;">Bonuses</td>
                                        <td style="text-align: right; padding: 10px 12px;">$${totalBonusesPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style="text-align: right; padding: 10px 12px; color: #666;">${((totalBonusesPaid / totalBrandSpend) * 100).toFixed(1)}%</td>
                                    </tr>
                                    ` : ''}
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 10px 12px;">Creators Corner Commission (${brandRate}%)</td>
                                        <td style="text-align: right; padding: 10px 12px;">$${ccCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style="text-align: right; padding: 10px 12px; color: #666;">${totalBrandSpend > 0 ? ((ccCommission / totalBrandSpend) * 100).toFixed(1) : 0}%</td>
                                    </tr>
                                    ${ccRetainer > 0 ? `
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 10px 12px;">Creators Corner Retainer</td>
                                        <td style="text-align: right; padding: 10px 12px;">$${ccRetainer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style="text-align: right; padding: 10px 12px; color: #666;">${((ccRetainer / totalBrandSpend) * 100).toFixed(1)}%</td>
                                    </tr>
                                    ` : ''}
                                </tbody>
                                <tfoot>
                                    <tr style="background: #fef2f2;">
                                        <td style="padding: 12px; font-weight: 700;">TOTAL BRAND SPEND</td>
                                        <td style="text-align: right; padding: 12px; font-weight: 700; color: #dc2626;">$${totalBrandSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style="text-align: right; padding: 12px; font-weight: 700;">100%</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <!-- Creator Performance -->
                        <div style="margin-bottom: 30px;">
                            <div style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px;">👥 Creator Performance (${creatorList.length} creators)</div>
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <thead>
                                    <tr style="background: #f8f9fa;">
                                        <th style="text-align: left; padding: 8px 10px; color: #666;">#</th>
                                        <th style="text-align: left; padding: 8px 10px; color: #666;">Creator</th>
                                        <th style="text-align: right; padding: 8px 10px; color: #666;">GMV</th>
                                        <th style="text-align: right; padding: 8px 10px; color: #666;">Orders</th>
                                        <th style="text-align: right; padding: 8px 10px; color: #666;">% of Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${creatorList.map((c, i) => `
                                        <tr style="border-bottom: 1px solid #e5e7eb;">
                                            <td style="padding: 6px 10px; color: #888;">${i + 1}</td>
                                            <td style="padding: 6px 10px;">@${c.name}</td>
                                            <td style="text-align: right; padding: 6px 10px; font-weight: 500;">$${c.gmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            <td style="text-align: right; padding: 6px 10px;">${c.orders.toLocaleString()}</td>
                                            <td style="text-align: right; padding: 6px 10px; color: #666;">${totalGmv > 0 ? ((c.gmv / totalGmv) * 100).toFixed(1) : 0}%</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                                <tfoot>
                                    <tr style="background: #f0fdf4; font-weight: 600;">
                                        <td colspan="2" style="padding: 10px;">TOTAL</td>
                                        <td style="text-align: right; padding: 10px;">$${totalGmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style="text-align: right; padding: 10px;">${totalOrders.toLocaleString()}</td>
                                        <td style="text-align: right; padding: 10px;">100%</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        
                        <!-- ROI Analysis -->
                        <div style="background: #f8f9fa; border-radius: 8px; padding: 20px;">
                            <div style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px;">📈 ROI Analysis</div>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
                                <div>
                                    <div style="font-size: 12px; color: #666; margin-bottom: 4px;">GMV : Spend Ratio</div>
                                    <div style="font-size: 28px; font-weight: 700; color: #16a34a;">${roi.toFixed(1)} : 1</div>
                                </div>
                                <div>
                                    <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Avg Order Value</div>
                                    <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">$${totalOrders > 0 ? (totalGmv / totalOrders).toFixed(2) : '0.00'}</div>
                                </div>
                                <div>
                                    <div style="font-size: 12px; color: #666; margin-bottom: 4px;">Cost per $1 GMV</div>
                                    <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">$${totalGmv > 0 ? (totalBrandSpend / totalGmv).toFixed(2) : '0.00'}</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Footer -->
                        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #888; font-size: 11px;">
                            Report generated by Creators Corner • ${new Date().toLocaleDateString()}
                        </div>
                    </div>
                `;
                
            } catch (err) {
                console.error('Failed to generate report:', err);
                preview.innerHTML = `<div style="padding: 40px; text-align: center; color: #dc2626;">Error generating report: ${err.message}</div>`;
            }
        }

        function downloadReportPDF() {
            const content = document.getElementById('monthlyReportPreview').innerHTML;
            const brand = document.getElementById('reportBrand').value;
            const month = document.getElementById('reportMonth').value;
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${BRAND_DISPLAY[brand] || brand} - ${month} Report</title>
                    <style>
                        body { margin: 0; padding: 0; }
                        @media print {
                            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        }
                    </style>
                </head>
                <body>${content}</body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }

        function copyReportHTML() {
            const content = document.getElementById('monthlyReportPreview').innerHTML;
            navigator.clipboard.writeText(content).then(() => {
                showToast('HTML copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        }

        // ==================== SPEND FORECAST ====================
        
        function openForecastModal() {
            // Populate month options (current month + next 2 months)
            const select = document.getElementById('forecastMonth');
            const now = new Date();
            const months = [];
            
            for (let i = 0; i < 3; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                months.push({ value, label });
            }
            
            select.innerHTML = months.map((m, i) => 
                `<option value="${m.value}" ${i === 0 ? 'selected' : ''}>${m.label}</option>`
            ).join('');
            
            document.getElementById('forecastModal').classList.add('show');
            generateForecast();
        }
        
        function closeForecastModal() {
            document.getElementById('forecastModal').classList.remove('show');
        }
        
        async function generateForecast() {
            const brand = document.getElementById('forecastBrand').value;
            const monthValue = document.getElementById('forecastMonth').value;
            const [year, month] = monthValue.split('-');
            const monthName = new Date(year, parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            
            const content = document.getElementById('forecastContent');
            content.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">Calculating forecast...</div>';
            
            try {
                // 1. Get all creators on retainer for this brand
                const { data: rosterData, error: rosterError } = await supabaseClient
                    .from('managed_creators')
                    .select('account_1, real_name, discord_name, retainer')
                    .eq('brand', brand);
                
                if (rosterError) throw rosterError;
                
                const creatorsOnRetainer = (rosterData || []).filter(c => c.retainer && parseFloat(c.retainer) > 0);
                const maxRetainerSpend = creatorsOnRetainer.reduce((sum, c) => sum + parseFloat(c.retainer), 0);
                const retainerCount = creatorsOnRetainer.length;
                
                // 2. Get historical claim data (last 3 months of paid retainers)
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                const historicalStartMonth = `${threeMonthsAgo.getFullYear()}-${String(threeMonthsAgo.getMonth() + 1).padStart(2, '0')}`;
                
                const { data: historicalPayments, error: histError } = await supabaseClient
                    .from('creator_payments')
                    .select('creator_name, amount, period_month, payment_type')
                    .eq('brand', brand)
                    .eq('payment_type', 'retainer')
                    .eq('status', 'paid')
                    .gte('period_month', historicalStartMonth);
                
                if (histError) throw histError;
                
                // Calculate historical claim rate
                let claimRate = 0.75; // Default 75% if no history
                let historicalMonths = 0;
                let totalHistoricalClaimed = 0;
                let totalHistoricalPossible = 0;
                
                if (historicalPayments && historicalPayments.length > 0) {
                    // Group by month
                    const monthlyData = {};
                    historicalPayments.forEach(p => {
                        if (!monthlyData[p.period_month]) {
                            monthlyData[p.period_month] = { claimed: 0, claimants: new Set() };
                        }
                        monthlyData[p.period_month].claimed += parseFloat(p.amount);
                        monthlyData[p.period_month].claimants.add(p.creator_name);
                    });
                    
                    historicalMonths = Object.keys(monthlyData).length;
                    
                    // For each historical month, calculate what % of max was claimed
                    Object.values(monthlyData).forEach(m => {
                        totalHistoricalClaimed += m.claimed;
                        totalHistoricalPossible += maxRetainerSpend; // Assume same roster size
                    });
                    
                    if (totalHistoricalPossible > 0) {
                        claimRate = totalHistoricalClaimed / totalHistoricalPossible;
                        claimRate = Math.min(Math.max(claimRate, 0.3), 1.0); // Clamp between 30% and 100%
                    }
                }
                
                // 3. Get already paid/pending for this month
                const { data: currentMonthPayments } = await supabaseClient
                    .from('creator_payments')
                    .select('creator_name, amount, status, payment_type')
                    .eq('brand', brand)
                    .eq('period_month', monthValue);
                
                const alreadyPaid = (currentMonthPayments || [])
                    .filter(p => p.status === 'paid' && p.payment_type === 'retainer')
                    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
                    
                const pendingApproval = (currentMonthPayments || [])
                    .filter(p => (p.status === 'pending' || p.status === 'approved') && p.payment_type === 'retainer')
                    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
                
                const paidCreators = new Set((currentMonthPayments || [])
                    .filter(p => p.payment_type === 'retainer')
                    .map(p => p.creator_name.toLowerCase()));
                
                // 4. Calculate forecasts
                const estimatedSpend = maxRetainerSpend * claimRate;
                const remainingEstimate = Math.max(0, estimatedSpend - alreadyPaid - pendingApproval);
                const lowEstimate = maxRetainerSpend * Math.max(0.5, claimRate - 0.15);
                const highEstimate = maxRetainerSpend * Math.min(1.0, claimRate + 0.10);
                
                // 5. List unclaimed creators
                const unclaimedCreators = creatorsOnRetainer
                    .filter(c => !paidCreators.has((c.real_name || c.discord_name || c.account_1 || '').toLowerCase()))
                    .sort((a, b) => parseFloat(b.retainer) - parseFloat(a.retainer));
                
                // Render forecast
                content.innerHTML = `
                    <div style="display: grid; gap: 20px;">
                        <!-- Summary Cards -->
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                            <div style="background: var(--bg-secondary); border-radius: 12px; padding: 16px; text-align: center;">
                                <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">Max Possible</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">${fmtMoney(maxRetainerSpend)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${retainerCount} creators</div>
                            </div>
                            <div style="background: linear-gradient(135deg, var(--purple-dim), var(--bg-secondary)); border-radius: 12px; padding: 16px; text-align: center; border: 1px solid var(--purple);">
                                <div style="font-size: 0.8rem; color: var(--purple); margin-bottom: 4px;">Estimated Spend</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--purple);">${fmtMoney(estimatedSpend)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${Math.round(claimRate * 100)}% claim rate</div>
                            </div>
                            <div style="background: var(--success-dim); border-radius: 12px; padding: 16px; text-align: center;">
                                <div style="font-size: 0.8rem; color: var(--success); margin-bottom: 4px;">Already Paid</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">${fmtMoney(alreadyPaid)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${paidCreators.size} creators</div>
                            </div>
                            <div style="background: var(--warning-dim); border-radius: 12px; padding: 16px; text-align: center;">
                                <div style="font-size: 0.8rem; color: var(--warning); margin-bottom: 4px;">Pending</div>
                                <div style="font-size: 1.5rem; font-weight: 700; color: var(--warning);">${fmtMoney(pendingApproval)}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">awaiting approval</div>
                            </div>
                        </div>
                        
                        <!-- Range Estimate -->
                        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px;">
                            <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 12px;">📊 Spend Range Estimate</div>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="text-align: center; flex: 1;">
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Conservative</div>
                                    <div style="font-size: 1.2rem; font-weight: 600;">${fmtMoney(lowEstimate)}</div>
                                </div>
                                <div style="flex: 2; height: 8px; background: linear-gradient(90deg, var(--success), var(--warning), var(--danger)); border-radius: 4px; position: relative;">
                                    <div style="position: absolute; left: ${Math.min(100, (estimatedSpend / maxRetainerSpend) * 100)}%; top: -6px; width: 3px; height: 20px; background: var(--text-primary); border-radius: 2px;"></div>
                                </div>
                                <div style="text-align: center; flex: 1;">
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Optimistic</div>
                                    <div style="font-size: 1.2rem; font-weight: 600;">${fmtMoney(highEstimate)}</div>
                                </div>
                            </div>
                            ${historicalMonths > 0 ? `
                                <div style="margin-top: 12px; font-size: 0.8rem; color: var(--text-muted);">
                                    Based on ${historicalMonths} months of payment history (${Math.round(claimRate * 100)}% average claim rate)
                                </div>
                            ` : `
                                <div style="margin-top: 12px; font-size: 0.8rem; color: var(--warning);">
                                    ⚠️ No payment history yet - using 75% default claim rate. Accuracy will improve as you track payments.
                                </div>
                            `}
                        </div>
                        
                        <!-- Unclaimed Creators -->
                        <div style="background: var(--bg-secondary); border-radius: 12px; padding: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                                <div style="font-size: 0.9rem; font-weight: 600;">⏳ Not Yet Claimed This Month (${unclaimedCreators.length})</div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">
                                    Potential: ${fmtMoney(unclaimedCreators.reduce((s, c) => s + parseFloat(c.retainer), 0))}
                                </div>
                            </div>
                            ${unclaimedCreators.length === 0 ? `
                                <div style="color: var(--success); text-align: center; padding: 20px;">✅ All creators have claimed!</div>
                            ` : `
                                <div style="max-height: 200px; overflow-y: auto;">
                                    <table style="width: 100%; font-size: 0.85rem;">
                                        ${unclaimedCreators.slice(0, 15).map(c => `
                                            <tr style="border-bottom: 1px solid var(--border);">
                                                <td style="padding: 8px 0;">${c.real_name || c.discord_name || c.account_1}</td>
                                                <td style="padding: 8px 0; text-align: right; color: var(--success);">${fmtMoney(c.retainer)}</td>
                                            </tr>
                                        `).join('')}
                                        ${unclaimedCreators.length > 15 ? `
                                            <tr><td colspan="2" style="padding: 8px 0; color: var(--text-muted); text-align: center;">
                                                +${unclaimedCreators.length - 15} more creators
                                            </td></tr>
                                        ` : ''}
                                    </table>
                                </div>
                            `}
                        </div>
                        
                        <!-- Quick Summary for Copy -->
                        <div id="forecastSummaryText" style="display: none;">
${BRAND_DISPLAY[brand]} - ${monthName} Spend Forecast

Max Possible: ${fmtMoney(maxRetainerSpend)} (${retainerCount} creators on retainer)
Estimated Spend: ${fmtMoney(estimatedSpend)} (${Math.round(claimRate * 100)}% claim rate)
Range: ${fmtMoney(lowEstimate)} - ${fmtMoney(highEstimate)}

Already Paid: ${fmtMoney(alreadyPaid)}
Pending Approval: ${fmtMoney(pendingApproval)}
Remaining Estimate: ${fmtMoney(remainingEstimate)}

${unclaimedCreators.length} creators have not yet claimed.
                        </div>
                    </div>
                `;
                
            } catch (err) {
                console.error('Failed to generate forecast:', err);
                content.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--danger);">Error: ${err.message}</div>`;
            }
        }
        
        function copyForecastToClipboard() {
            const summaryEl = document.getElementById('forecastSummaryText');
            if (!summaryEl) {
                showToast('Generate forecast first', 'warning');
                return;
            }
            
            navigator.clipboard.writeText(summaryEl.textContent.trim()).then(() => {
                showToast('Forecast copied to clipboard!', 'success');
            }).catch(() => {
                showToast('Failed to copy', 'error');
            });
        }

        function filterPaymentsByStatus(status) {
            setPaymentsStatusFilter(status);
        }

        // Legacy function redirect
        function loadPaymentsData() {
            loadPaymentsView();
        }

        function openBulkPaymentModal() {
            if (selectedPaymentIds.size === 0) {
                showToast('Select payments first', 'error');
                return;
            }
            document.getElementById('bulkPaymentModal').classList.add('show');
        }

        function closeBulkPaymentModal() {
            document.getElementById('bulkPaymentModal').classList.remove('show');
        }

        async function applyBulkPayment() {
            if (selectedPaymentIds.size === 0) return;
            
            const status = document.getElementById('bulkPaymentStatus').value;
            const method = document.getElementById('bulkPaymentMethod').value;
            const reference = document.getElementById('bulkPaymentReference').value;
            
            try {
                const updateData = {
                    status: status,
                    updated_at: new Date().toISOString()
                };
                
                if (method) updateData.payment_method = method;
                if (reference) updateData.payment_reference = reference;
                if (status === 'paid') updateData.paid_at = new Date().toISOString();
                
                const ids = Array.from(selectedPaymentIds);
                
                const { error } = await supabaseClient
                    .from('creator_payments')
                    .update(updateData)
                    .in('id', ids);
                
                if (error) throw error;
                
                showToast(`Updated ${ids.length} payments!`, 'success');
                selectedPaymentIds.clear();
                closeBulkPaymentModal();
                loadPaymentsView();
            } catch (err) {
                console.error('Failed to bulk update:', err);
                showToast('Failed to update payments', 'error');
            }
        }

        async function exportPaymentsCSV() {
            try {
                const brandFilter = document.getElementById('paymentsBrandFilter')?.value || 'all';
                const periodFilter = document.getElementById('paymentsPeriodFilter')?.value || '';
                
                let query = supabaseClient.from('creator_payments').select('*').order('creator_name');
                if (brandFilter !== 'all') query = query.eq('brand', brandFilter);
                if (periodFilter) query = query.eq('period_month', periodFilter);
                if (paymentsStatusFilter !== 'all') query = query.eq('status', paymentsStatusFilter);
                
                const { data, error } = await query;
                if (error) throw error;
                
                if (!data || data.length === 0) {
                    showToast('No data to export', 'warning');
                    return;
                }
                
                // CSV header
                const headers = ['Creator', 'Brand', 'Type', 'Amount', 'Period', 'Status', 'Date Submitted', 'Date Approved', 'Date Paid', 'Notes'];
                const rows = data.map(p => [
                    p.creator_name,
                    BRAND_DISPLAY[p.brand] || p.brand,
                    p.payment_type,
                    p.amount,
                    p.period_month,
                    p.status,
                    p.date_submitted || '',
                    p.date_approved || '',
                    p.date_paid || '',
                    (p.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
                ]);
                
                const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `payments_export_${new Date().toISOString().slice(0,10)}.csv`;
                a.click();
                
                showToast('CSV exported!', 'success');
            } catch (err) {
                console.error('Failed to export:', err);
                showToast('Failed to export', 'error');
            }
        }

        // ==================== GENERATE PAYMENTS FROM PERFORMANCE ====================
