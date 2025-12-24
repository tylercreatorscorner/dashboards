// ==================== PORTAL & APPLICATIONS ====================
        // ==================== CREATOR PORTAL ====================
        let creatorPortalData = [];
        let creatorApplicantsData = [];
        let groupedCreators = [];
        let portalAdmins = [];
        let accountRequests = [];
        
        async function loadCreatorPortalData() {
            showLoading('creatorportal', 'Loading creator portal data...');
            try {
                const brandFilter = document.getElementById('creatorPortalBrandFilter')?.value || 'all';
                const statusFilter = document.getElementById('creatorPortalStatusFilter')?.value || 'all';
                
                // Load creators from managed_creators
                let creatorsQuery = supabaseClient.from('managed_creators').select('*').order('account_1', { ascending: true });
                
                const { data: creators, error: creatorsError } = await creatorsQuery;
                if (creatorsError) throw creatorsError;
                
                creatorPortalData = creators || [];
                
                // Group creators by discord_id or account_1
                groupedCreators = groupCreatorsByIdentity(creatorPortalData);
                
                // Apply filters
                let filteredCreators = groupedCreators;
                if (brandFilter !== 'all') {
                    filteredCreators = filteredCreators.filter(g => g.brands.includes(brandFilter));
                }
                if (statusFilter === 'linked') {
                    filteredCreators = filteredCreators.filter(g => g.hasDiscord);
                } else if (statusFilter === 'unlinked') {
                    filteredCreators = filteredCreators.filter(g => !g.hasDiscord);
                }
                
                // Load pending applicants
                let applicantsQuery = supabaseClient.from('creator_applications').select('*').in('status', ['pending', 'reviewing', 'waitlist']).order('created_at', { ascending: false });
                if (brandFilter !== 'all') {
                    applicantsQuery = applicantsQuery.eq('brand', brandFilter);
                }
                
                const { data: applicants, error: applicantsError } = await applicantsQuery;
                if (applicantsError) throw applicantsError;
                
                creatorApplicantsData = applicants || [];
                
                // Load portal admins
                const { data: admins } = await supabaseClient.from('brand_portal_users').select('*').eq('role', 'admin').order('created_at', { ascending: false });
                portalAdmins = admins || [];
                
                // Load pending account requests
                const { data: requests } = await supabaseClient.from('creator_account_requests').select('*').eq('status', 'pending').order('created_at', { ascending: false });
                accountRequests = requests || [];
                
                // Render tables
                renderCreatorPortalTable(filteredCreators);
                renderCreatorApplicantsTable(creatorApplicantsData);
                renderPortalAdminsTable(portalAdmins);
                renderAccountRequestsTable(accountRequests);
                updateCreatorPortalStats();
                
            } catch (err) {
                console.error('Error loading creator portal data:', err);
                showToast('Failed to load creator portal data', 'error');
            } finally {
                hideLoading('creatorportal');
            }
        }
        
        function groupCreatorsByIdentity(creators) {
            const groups = {};
            
            creators.forEach(c => {
                // Group key: discord_id if available, otherwise first account
                const key = (c.discord_id && c.discord_id.trim()) ? `d_${c.discord_id}` : `a_${(c.account_1 || '').toLowerCase()}`;
                
                if (!groups[key]) {
                    groups[key] = {
                        key: key,
                        displayName: c.real_name || c.account_1 || 'Unknown',
                        discordId: c.discord_id || null,
                        discordName: c.discord_name || null,
                        discordAvatar: c.discord_avatar || null,
                        hasDiscord: !!(c.discord_id && c.discord_id.trim()),
                        brands: [],
                        accounts: [],
                        records: []
                    };
                }
                
                // Add brand if not already present
                if (c.brand && !groups[key].brands.includes(c.brand)) {
                    groups[key].brands.push(c.brand);
                }
                
                // Add accounts
                [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].forEach(a => {
                    if (a && a.trim() && !groups[key].accounts.includes(a.toLowerCase())) {
                        groups[key].accounts.push(a.toLowerCase());
                    }
                });
                
                // Keep reference to original records (for linking)
                groups[key].records.push(c);
                
                // Update display name if we find a real_name
                if (c.real_name && (!groups[key].displayName || groups[key].displayName === c.account_1)) {
                    groups[key].displayName = c.real_name;
                }
                
                // Update discord info if found
                if (c.discord_id && c.discord_id.trim()) {
                    groups[key].hasDiscord = true;
                    groups[key].discordId = c.discord_id;
                    groups[key].discordName = c.discord_name || groups[key].discordName;
                    groups[key].discordAvatar = c.discord_avatar || groups[key].discordAvatar;
                }
            });
            
            return Object.values(groups).sort((a, b) => a.displayName.localeCompare(b.displayName));
        }
        
        let selectedCreatorKeys = new Set();
        
        function renderCreatorPortalTable(creators) {
            const tbody = document.getElementById('creatorPortalBody');
            if (!creators || creators.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No creators found</td></tr>';
                return;
            }
            
            const brandDisplay = { 'catakor': 'Cata-Kor', 'jiyu': 'JiYu', 'physicians_choice': 'Physicians Choice', 'peach_slices': 'Peach Slices', 'yerba_magic': 'Yerba Magic' };
            const brandColors = { 'catakor': '#ef4444', 'jiyu': '#8b5cf6', 'physicians_choice': '#3b82f6', 'peach_slices': '#f59e0b', 'yerba_magic': '#22c55e' };
            
            tbody.innerHTML = creators.map(g => {
                const accounts = g.accounts.map(a => `@${a}`).join(', ');
                const brandBadges = g.brands.map(b => `<span class="badge" style="background: ${brandColors[b] || '#666'}20; color: ${brandColors[b] || '#666'}; font-size: 0.7rem; padding: 2px 6px; margin-right: 4px;">${brandDisplay[b] || b}</span>`).join('');
                const firstRecordId = g.records[0]?.id;
                const isSelected = selectedCreatorKeys.has(g.key);
                
                return `<tr data-search="${g.displayName.toLowerCase()} ${g.discordName?.toLowerCase() || ''} ${g.accounts.join(' ')}" data-key="${g.key}" style="${isSelected ? 'background: var(--accent-dim);' : ''}">
                    <td style="text-align: center;">
                        <input type="checkbox" class="creator-checkbox" data-key="${g.key}" ${isSelected ? 'checked' : ''} onchange="toggleCreatorSelection('${g.key}')">
                    </td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${g.hasDiscord ? 'var(--success-dim)' : 'var(--warning-dim)'}; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; flex-shrink: 0;">
                                ${g.discordAvatar ? `<img src="${g.discordAvatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : g.displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600;">${g.displayName}</div>
                                ${g.brands.length > 1 ? `<div style="font-size: 0.7rem; color: var(--purple);">📦 ${g.brands.length} brands</div>` : ''}
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-size: 0.85rem;">${g.discordName || '-'}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${g.hasDiscord ? g.discordId : 'Not linked'}</div>
                    </td>
                    <td style="max-width: 180px;">${brandBadges || '-'}</td>
                    <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${accounts}">${accounts || '-'}</td>
                    <td>
                        ${g.hasDiscord 
                            ? '<span class="status-badge" style="background: var(--success-dim); color: var(--success);">✅ Can Login</span>'
                            : '<span class="status-badge" style="background: var(--warning-dim); color: var(--warning);">⚠️ No Access</span>'
                        }
                    </td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            ${!g.hasDiscord ? `<button class="btn btn-sm" onclick="promptLinkDiscordGroup('${g.key}', '${g.displayName.replace(/'/g, "\\'")}')">🔗 Link</button>` : ''}
                            <button class="btn btn-sm" onclick="viewCreatorInPortal(${firstRecordId})">👁️ View</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
            
            updateMergeBar();
        }
        
        function toggleCreatorSelection(key) {
            if (selectedCreatorKeys.has(key)) {
                selectedCreatorKeys.delete(key);
            } else {
                selectedCreatorKeys.add(key);
            }
            updateMergeBar();
            updateRowHighlights();
        }
        
        function toggleSelectAllCreators(checkbox) {
            const visibleRows = document.querySelectorAll('#creatorPortalBody tr[data-key]:not([style*="display: none"])');
            visibleRows.forEach(row => {
                const key = row.getAttribute('data-key');
                if (checkbox.checked) {
                    selectedCreatorKeys.add(key);
                } else {
                    selectedCreatorKeys.delete(key);
                }
                const cb = row.querySelector('.creator-checkbox');
                if (cb) cb.checked = checkbox.checked;
            });
            updateMergeBar();
            updateRowHighlights();
        }
        
        function updateRowHighlights() {
            document.querySelectorAll('#creatorPortalBody tr[data-key]').forEach(row => {
                const key = row.getAttribute('data-key');
                row.style.background = selectedCreatorKeys.has(key) ? 'var(--accent-dim)' : '';
            });
        }
        
        function updateMergeBar() {
            const mergeBar = document.getElementById('mergeBar');
            const mergeCount = document.getElementById('mergeCount');
            const count = selectedCreatorKeys.size;
            
            if (count >= 2) {
                mergeBar.style.display = 'flex';
                mergeCount.textContent = `${count} selected`;
            } else {
                mergeBar.style.display = 'none';
            }
        }
        
        function clearMergeSelection() {
            selectedCreatorKeys.clear();
            document.querySelectorAll('.creator-checkbox').forEach(cb => cb.checked = false);
            document.getElementById('selectAllCreators').checked = false;
            updateMergeBar();
            updateRowHighlights();
        }
        
        function showMergeModal() {
            if (selectedCreatorKeys.size < 2) {
                showToast('Select at least 2 creators to merge', 'warning');
                return;
            }
            
            const modal = document.getElementById('mergeCreatorsModal');
            const preview = document.getElementById('mergePreview');
            const stats = document.getElementById('mergeStats');
            
            // Get selected creators
            const selected = groupedCreators.filter(g => selectedCreatorKeys.has(g.key));
            
            // Build preview
            let totalRecords = 0;
            let allBrands = new Set();
            let allAccounts = new Set();
            let existingDiscordId = null;
            
            preview.innerHTML = selected.map(g => {
                totalRecords += g.records.length;
                g.brands.forEach(b => allBrands.add(b));
                g.accounts.forEach(a => allAccounts.add(a));
                if (g.hasDiscord && !existingDiscordId) existingDiscordId = g.discordId;
                
                return `<div style="padding: 8px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; background: ${g.hasDiscord ? 'var(--success-dim)' : 'var(--warning-dim)'}; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                        ${g.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 0.9rem;">${g.displayName}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${g.accounts.map(a => '@' + a).join(', ')}</div>
                    </div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${g.records.length} record${g.records.length > 1 ? 's' : ''}</div>
                </div>`;
            }).join('');
            
            // Build stats
            stats.innerHTML = `
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div><strong>${selected.length}</strong> creators</div>
                    <div><strong>${totalRecords}</strong> database records</div>
                    <div><strong>${allBrands.size}</strong> brands</div>
                    <div><strong>${allAccounts.size}</strong> TikTok accounts</div>
                </div>
            `;
            
            // Pre-fill Discord ID if one exists
            const discordInput = document.getElementById('mergeDiscordId');
            discordInput.value = existingDiscordId || '';
            
            modal.style.display = 'flex';
        }
        
        function hideMergeModal() {
            document.getElementById('mergeCreatorsModal').style.display = 'none';
        }
        
        async function executeMerge() {
            const discordId = document.getElementById('mergeDiscordId').value.trim();
            if (!discordId) {
                showToast('Please enter a Discord ID', 'warning');
                return;
            }
            
            const selected = groupedCreators.filter(g => selectedCreatorKeys.has(g.key));
            const allRecords = selected.flatMap(g => g.records);
            
            if (!confirm(`This will update ${allRecords.length} database records with Discord ID: ${discordId}\n\nAre you sure?`)) {
                return;
            }
            
            try {
                let updated = 0;
                for (const record of allRecords) {
                    const { error } = await supabaseClient.from('managed_creators')
                        .update({ discord_id: discordId })
                        .eq('id', record.id);
                    if (!error) updated++;
                }
                
                showToast(`Merged ${selected.length} creators (${updated} records updated)!`, 'success');
                hideMergeModal();
                clearMergeSelection();
                loadCreatorPortalData();
            } catch (err) {
                console.error(err);
                showToast('Failed to merge creators', 'error');
            }
        }
        
        function filterCreatorPortalTable() {
            const search = document.getElementById('creatorPortalSearch').value.toLowerCase().trim();
            const rows = document.querySelectorAll('#creatorPortalBody tr[data-search]');
            
            rows.forEach(row => {
                const searchData = row.getAttribute('data-search') || '';
                row.style.display = searchData.includes(search) ? '' : 'none';
            });
        }
        
        function renderCreatorApplicantsTable(applicants) {
            const tbody = document.getElementById('creatorApplicantsBody');
            if (!applicants || applicants.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No pending applicants</td></tr>';
                return;
            }
            
            tbody.innerHTML = applicants.map(a => {
                const hasDiscord = a.discord_id && a.discord_id.trim() !== '';
                const statusColors = { 'pending': 'warning', 'reviewing': 'blue', 'waitlist': 'purple' };
                
                return `<tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--${statusColors[a.status] || 'warning'}-dim); display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                                ${(a.discord_username || a.tiktok_handle || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600;">${a.discord_username || a.tiktok_handle || 'Unknown'}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">ID: ${a.id}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-size: 0.85rem;">${a.discord_username || '-'}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${hasDiscord ? a.discord_id : 'Not linked'}</div>
                    </td>
                    <td>@${a.tiktok_handle || '-'}</td>
                    <td><span class="status-badge status-${a.status}">${a.status}</span></td>
                    <td>${a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}</td>
                    <td>
                        ${hasDiscord 
                            ? '<span class="status-badge" style="background: var(--success-dim); color: var(--success);">✅ Can View Learn</span>'
                            : '<span class="status-badge" style="background: var(--error-dim); color: var(--error);">❌ No Access</span>'
                        }
                    </td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-sm" onclick="switchView('applications')">📋 Manage</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }
        
        function renderPortalAdminsTable(admins) {
            const tbody = document.getElementById('portalAdminsBody');
            if (!admins || admins.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No admins configured</td></tr>';
                return;
            }
            
            tbody.innerHTML = admins.map(a => {
                return `<tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--accent-dim); display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                                ${a.discord_avatar ? `<img src="${a.discord_avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : (a.discord_username || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600;">${a.discord_username || 'Unknown'}</div>
                                <div style="font-size: 0.75rem; color: var(--accent);">👑 Admin</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-size: 0.85rem;">${a.discord_username || '-'}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${a.discord_id || '-'}</div>
                    </td>
                    <td>${a.discord_email || '-'}</td>
                    <td>${a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="removePortalAdmin('${a.id}', '${(a.discord_username || '').replace(/'/g, "\\'")}')">🗑️ Remove</button>
                    </td>
                </tr>`;
            }).join('');
        }
        
        function renderAccountRequestsTable(requests) {
            const tbody = document.getElementById('accountRequestsBody');
            if (!requests || requests.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No pending account requests 🎉</td></tr>';
                return;
            }
            
            tbody.innerHTML = requests.map(r => {
                return `<tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--info-dim); display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                                ${(r.discord_username || '?').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600;">${r.discord_username || 'Unknown'}</div>
                                <div style="font-size: 0.7rem; color: var(--text-muted);">${r.discord_id || '-'}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div style="font-weight: 600; color: var(--accent);">@${r.tiktok_handle}</div>
                        ${r.notes ? `<div style="font-size: 0.7rem; color: var(--text-muted);">${r.notes}</div>` : ''}
                    </td>
                    <td>
                        ${r.has_existing_data 
                            ? '<span class="status-badge" style="background: var(--warning-dim); color: var(--warning);">⚠️ Yes - Verify</span>'
                            : '<span class="status-badge" style="background: var(--success-dim); color: var(--success);">✓ No data</span>'
                        }
                    </td>
                    <td>${r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-sm btn-success" onclick="approveAccountRequest(${r.id}, '${r.discord_id}', '${r.tiktok_handle}', '${(r.discord_username || '').replace(/'/g, "\\'")}')">✓ Approve</button>
                            <button class="btn btn-sm btn-danger" onclick="denyAccountRequest(${r.id}, '${(r.discord_username || '').replace(/'/g, "\\'")}', '${r.tiktok_handle}')">✕ Deny</button>
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }
        
        async function approveAccountRequest(requestId, discordId, tiktokHandle, discordUsername) {
            if (!confirm(`Approve @${tiktokHandle} for ${discordUsername}?\n\nThis will link the account to their Discord.`)) return;
            
            try {
                // Update request status
                const { error: updateError } = await supabaseClient
                    .from('creator_account_requests')
                    .update({ 
                        status: 'approved',
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: window.currentUser?.username || 'admin'
                    })
                    .eq('id', requestId);
                
                if (updateError) throw updateError;
                
                // Check if account exists in managed_creators without discord
                const { data: existingRecord } = await supabaseClient
                    .from('managed_creators')
                    .select('id')
                    .or(`account_1.ilike.${tiktokHandle},account_2.ilike.${tiktokHandle},account_3.ilike.${tiktokHandle},account_4.ilike.${tiktokHandle},account_5.ilike.${tiktokHandle}`)
                    .is('discord_id', null)
                    .limit(1);
                
                if (existingRecord && existingRecord.length > 0) {
                    // Link Discord to existing record
                    await supabaseClient
                        .from('managed_creators')
                        .update({ discord_id: discordId })
                        .eq('id', existingRecord[0].id);
                }
                
                showToast(`Approved @${tiktokHandle} for ${discordUsername}!`, 'success');
                loadCreatorPortalData();
            } catch (err) {
                console.error('Error approving request:', err);
                showToast('Failed to approve request', 'error');
            }
        }
        
        async function denyAccountRequest(requestId, discordUsername, tiktokHandle) {
            const reason = prompt(`Deny @${tiktokHandle} for ${discordUsername}?\n\nEnter a reason (optional):`);
            if (reason === null) return; // Cancelled
            
            try {
                const { error } = await supabaseClient
                    .from('creator_account_requests')
                    .update({ 
                        status: 'denied',
                        denial_reason: reason || 'Request denied by admin',
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: window.currentUser?.username || 'admin'
                    })
                    .eq('id', requestId);
                
                if (error) throw error;
                
                showToast(`Denied @${tiktokHandle} for ${discordUsername}`, 'info');
                loadCreatorPortalData();
            } catch (err) {
                console.error('Error denying request:', err);
                showToast('Failed to deny request', 'error');
            }
        }
        
        function updateCreatorPortalStats() {
            const linked = groupedCreators.filter(g => g.hasDiscord).length;
            const unlinked = groupedCreators.filter(g => !g.hasDiscord).length;
            const total = groupedCreators.length;
            const pending = creatorApplicantsData.length;
            const linkRate = total > 0 ? Math.round((linked / total) * 100) : 0;
            
            document.getElementById('statLinkedCreators').textContent = linked.toLocaleString();
            document.getElementById('statUnlinkedCreators').textContent = unlinked.toLocaleString();
            document.getElementById('statTotalActiveCreators').textContent = total.toLocaleString();
            document.getElementById('statPendingApplicants').textContent = pending.toLocaleString();
            document.getElementById('statLinkRate').textContent = linkRate + '%';
            
            // Update badges
            const badge = document.getElementById('pendingCreatorPortalBadge');
            const applicantsBadge = document.getElementById('applicantsTabBadge');
            const requestsBadge = document.getElementById('accountRequestsBadge');
            
            if (unlinked > 0) {
                badge.textContent = unlinked;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
            if (pending > 0) {
                applicantsBadge.textContent = pending;
                applicantsBadge.style.display = 'inline-flex';
            } else {
                applicantsBadge.style.display = 'none';
            }
            if (accountRequests.length > 0) {
                requestsBadge.textContent = accountRequests.length;
                requestsBadge.style.display = 'inline-flex';
            } else {
                requestsBadge.style.display = 'none';
            }
        }
        
        function switchCreatorPortalTab(tab) {
            // Update tab buttons
            document.querySelectorAll('[data-cptab]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.cptab === tab);
            });
            // Show/hide content
            document.getElementById('cpTab-creators').style.display = tab === 'creators' ? 'block' : 'none';
            document.getElementById('cpTab-requests').style.display = tab === 'requests' ? 'block' : 'none';
            document.getElementById('cpTab-applicants').style.display = tab === 'applicants' ? 'block' : 'none';
            document.getElementById('cpTab-admins').style.display = tab === 'admins' ? 'block' : 'none';
        }
        
        function copyCreatorPortalLink() {
            const link = window.location.origin + '/creator-portal.html';
            navigator.clipboard.writeText(link);
            showToast('Creator Portal link copied!', 'success');
        }
        
        async function promptLinkDiscordGroup(groupKey, creatorName) {
            const discordId = prompt(`Enter Discord ID for ${creatorName}:\n\n(You can find this by right-clicking the user in Discord with Developer Mode enabled)`);
            if (!discordId || !discordId.trim()) return;
            
            // Find all records in this group
            const group = groupedCreators.find(g => g.key === groupKey);
            if (!group) return;
            
            try {
                // First, link the selected group's records
                const recordsToLink = [...group.records];
                
                // Search for other potential matches (same real_name or overlapping accounts)
                const realName = group.displayName;
                const accounts = group.accounts;
                
                // Find other unlinked groups that might be the same person
                const potentialMatches = groupedCreators.filter(g => {
                    if (g.key === groupKey) return false; // Skip current group
                    if (g.hasDiscord) return false; // Skip already linked
                    
                    // Check name match (case insensitive)
                    const nameMatch = realName && g.displayName && 
                        realName.toLowerCase() === g.displayName.toLowerCase();
                    
                    // Check for overlapping accounts
                    const accountOverlap = g.accounts.some(a => accounts.includes(a));
                    
                    return nameMatch || accountOverlap;
                });
                
                // If there are potential matches, ask user
                if (potentialMatches.length > 0) {
                    const matchInfo = potentialMatches.map(m => {
                        const brands = m.brands.map(b => {
                            const brandDisplay = { 'catakor': 'Cata-Kor', 'jiyu': 'JiYu', 'physicians_choice': 'Physicians Choice', 'peach_slices': 'Peach Slices', 'yerba_magic': 'Yerba Magic' };
                            return brandDisplay[b] || b;
                        }).join(', ');
                        return `• ${m.displayName} (${brands}) - @${m.accounts[0]}`;
                    }).join('\n');
                    
                    const linkAll = confirm(
                        `Found ${potentialMatches.length} other entry(s) that might be the same person:\n\n` +
                        `${matchInfo}\n\n` +
                        `Link ALL of them with this Discord ID?`
                    );
                    
                    if (linkAll) {
                        potentialMatches.forEach(m => {
                            recordsToLink.push(...m.records);
                        });
                    }
                }
                
                // Update all records
                for (const record of recordsToLink) {
                    await supabaseClient.from('managed_creators')
                        .update({ discord_id: discordId.trim() })
                        .eq('id', record.id);
                }
                
                showToast(`Discord linked for ${creatorName} (${recordsToLink.length} record${recordsToLink.length > 1 ? 's' : ''})!`, 'success');
                loadCreatorPortalData();
            } catch (err) {
                console.error(err);
                showToast('Failed to link Discord', 'error');
            }
        }
        
        function viewCreatorInPortal(creatorId) {
            window.open(`/creator-portal.html?creator=${creatorId}`, '_blank');
        }
        
        // Portal Admin management
        function showAddAdminModal() {
            document.getElementById('addAdminModal').style.display = 'flex';
            document.getElementById('newAdminDiscordId').value = '';
            document.getElementById('newAdminDiscordId').focus();
        }
        
        function hideAddAdminModal() {
            document.getElementById('addAdminModal').style.display = 'none';
        }
        
        async function addPortalAdmin() {
            const discordId = document.getElementById('newAdminDiscordId').value.trim();
            if (!discordId) {
                showToast('Please enter a Discord ID', 'warning');
                return;
            }
            
            try {
                // Check if user exists in brand_portal_users
                const { data: existing } = await supabaseClient.from('brand_portal_users').select('*').eq('discord_id', discordId).single();
                
                if (existing) {
                    // Update existing user to admin
                    const { error } = await supabaseClient.from('brand_portal_users')
                        .update({ role: 'admin' })
                        .eq('discord_id', discordId);
                    if (error) throw error;
                    showToast(`${existing.discord_username || 'User'} is now a Portal Admin!`, 'success');
                } else {
                    // Create new admin user
                    const { error } = await supabaseClient.from('brand_portal_users')
                        .insert({ 
                            discord_id: discordId, 
                            role: 'admin', 
                            status: 'approved',
                            discord_username: 'Admin (pending login)'
                        });
                    if (error) throw error;
                    showToast('Admin added! They need to log into Creator Portal once to complete setup.', 'success');
                }
                
                hideAddAdminModal();
                loadCreatorPortalData();
            } catch (err) {
                console.error(err);
                showToast('Failed to add admin', 'error');
            }
        }
        
        async function removePortalAdmin(id, username) {
            if (!confirm(`Remove admin access for ${username}?`)) return;
            
            try {
                const { error } = await supabaseClient.from('brand_portal_users')
                    .update({ role: 'user' })
                    .eq('id', id);
                if (error) throw error;
                showToast(`${username} is no longer an admin`, 'success');
                loadCreatorPortalData();
            } catch (err) {
                console.error(err);
                showToast('Failed to remove admin', 'error');
            }
        }

        // ==================== CREATOR APPLICATIONS ====================
        let allApplications = [];
        
        async function loadApplicationsData() {
            showLoading('applications', 'Loading applications...');
            try {
                const statusFilter = document.getElementById('appStatusFilter')?.value || 'pending';
                const brandFilter = document.getElementById('appBrandFilter')?.value || 'all';
                
                let query = supabaseClient.from('creator_applications').select('*').order('created_at', { ascending: false });
                
                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }
                if (brandFilter !== 'all') {
                    query = query.eq('brand', brandFilter);
                }
                
                const { data, error } = await query;
                if (error) throw error;
                
                allApplications = data || [];
                renderApplicationsTable(allApplications, statusFilter, brandFilter);
                updateApplicationStats();
                
            } catch (err) {
                console.error('Error loading applications:', err);
                showToast('Failed to load applications', 'error');
            } finally {
                hideLoading('applications');
            }
        }
        
        function filterApplicationsByStatus(status) {
            document.getElementById('appStatusFilter').value = status;
            loadApplicationsData();
        }
        
        async function updateApplicationStats() {
            try {
                const { data, error } = await supabaseClient
                    .from('creator_applications')
                    .select('status');
                    
                if (error) throw error;
                
                const stats = {
                    pending: 0,
                    reviewing: 0,
                    accepted: 0,
                    rejected: 0,
                    total: data?.length || 0
                };
                
                data?.forEach(app => {
                    if (stats.hasOwnProperty(app.status)) {
                        stats[app.status]++;
                    }
                });
                
                document.getElementById('statPendingApps').textContent = stats.pending;
                document.getElementById('statReviewingApps').textContent = stats.reviewing;
                document.getElementById('statAcceptedApps').textContent = stats.accepted;
                document.getElementById('statRejectedApps').textContent = stats.rejected;
                document.getElementById('statTotalApps').textContent = stats.total;
                
                // Update badge
                const badge = document.getElementById('pendingAppsBadge');
                if (badge) {
                    badge.textContent = stats.pending;
                    badge.style.display = stats.pending > 0 ? 'inline-block' : 'none';
                }
                
                // Store stats for empty state
                window.appStats = stats;
            } catch (err) {
                console.error('Error updating app stats:', err);
            }
        }
        
        function renderApplicationsTable(applications, statusFilter = 'pending', brandFilter = 'all') {
            const tbody = document.getElementById('applicationsTableBody');
            if (!tbody) return;
            
            if (!applications || applications.length === 0) {
                const stats = window.appStats || {};
                const statusLabels = {
                    'pending': 'pending',
                    'reviewing': 'in review',
                    'accepted': 'accepted',
                    'rejected': 'rejected',
                    'waitlist': 'on waitlist',
                    'all': ''
                };
                
                let emptyMessage = '';
                let suggestion = '';
                
                if (statusFilter === 'pending' && stats.pending === 0) {
                    emptyMessage = '🎉 No pending applications!';
                    if (stats.total > 0) {
                        suggestion = `You have ${stats.total} total application${stats.total > 1 ? 's' : ''}.`;
                        if (stats.reviewing > 0) suggestion += ` <a href="#" onclick="filterApplicationsByStatus('reviewing'); return false;" style="color: var(--accent);">${stats.reviewing} in review</a>`;
                        if (stats.accepted > 0) suggestion += `${stats.reviewing > 0 ? ',' : ''} <a href="#" onclick="filterApplicationsByStatus('accepted'); return false;" style="color: var(--success);">${stats.accepted} accepted</a>`;
                        if (stats.rejected > 0) suggestion += `${(stats.reviewing > 0 || stats.accepted > 0) ? ',' : ''} <a href="#" onclick="filterApplicationsByStatus('rejected'); return false;" style="color: var(--danger);">${stats.rejected} rejected</a>`;
                    } else {
                        suggestion = 'Share your application link to start receiving applications!';
                    }
                } else if (statusFilter !== 'all') {
                    emptyMessage = `No ${statusLabels[statusFilter]} applications`;
                    suggestion = `<a href="#" onclick="filterApplicationsByStatus('all'); return false;" style="color: var(--accent);">View all applications</a>`;
                } else {
                    emptyMessage = 'No applications found';
                    suggestion = 'Share your application link to start receiving applications!';
                }
                
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 60px 40px;">
                            <div style="font-size: 2rem; margin-bottom: 12px;">📋</div>
                            <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">${emptyMessage}</div>
                            <div style="color: var(--text-muted); font-size: 0.9rem;">${suggestion}</div>
                        </td>
                    </tr>
                `;
                return;
            }
            
            const statusColors = {
                'pending': 'warning',
                'reviewing': 'info',
                'accepted': 'success',
                'rejected': 'danger',
                'waitlist': 'purple'
            };
            const statusIcons = {
                'pending': '⏳',
                'reviewing': '👀',
                'accepted': '✅',
                'rejected': '❌',
                'waitlist': '📝'
            };
            
            tbody.innerHTML = applications.map(app => {
                const hasDiscord = app.discord_username || app.discord_name || app.discord_id;
                const discordVerified = app.discord_id ? true : false;
                const discordIcon = hasDiscord ? (discordVerified ? '<span title="Discord OAuth Verified" style="color: #5865F2; margin-left: 6px;">✓</span>' : '<span title="Discord (manual)" style="color: var(--text-muted); margin-left: 6px;">💬</span>') : '';
                
                return `
                <tr>
                    <td onclick="event.stopPropagation();">
                        <input type="checkbox" class="bulk-checkbox" data-id="${app.id}" onchange="toggleApplicationSelect(this, '${app.id}')">
                    </td>
                    <td>
                        <div style="font-weight: 600;">${app.full_name || 'Unknown'}${discordIcon}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted);">${app.email || (hasDiscord ? (app.discord_username || app.discord_name) : '')}</div>
                    </td>
                    <td>
                        <a href="https://tiktok.com/@${app.tiktok_handle}" target="_blank" style="color: var(--accent); font-weight: 500;">
                            @${app.tiktok_handle}
                        </a>
                    </td>
                    <td><span class="badge badge-outline">${BRAND_DISPLAY[app.brand] || app.brand}</span></td>
                    <td>${app.follower_count || '-'}</td>
                    <td><span class="badge badge-${statusColors[app.status] || 'secondary'}">${statusIcons[app.status] || ''} ${app.status}</span></td>
                    <td style="color: var(--text-muted); font-size: 0.8rem;">${new Date(app.created_at).toLocaleDateString()}</td>
                    <td style="text-align: right;">
                        <div style="display: flex; gap: 6px; justify-content: flex-end;">
                            ${app.status === 'pending' || app.status === 'reviewing' ? `
                                <button class="btn btn-small btn-success" onclick="quickAcceptFromTable('${app.id}')" title="Accept">✅</button>
                                <button class="btn btn-small btn-danger" onclick="quickRejectFromTable('${app.id}')" title="Reject">❌</button>
                            ` : ''}
                            <button class="btn btn-small" onclick="openApplicationModal('${app.id}')" title="Review">👁️</button>
                        </div>
                    </td>
                </tr>
            `}).join('');
        }
        
        function openApplicationModal(appId) {
            const app = allApplications.find(a => a.id === appId);
            if (!app) return;
            
            // Parse extra_data for all answers
            let extraData = {};
            try {
                extraData = typeof app.extra_data === 'string' ? JSON.parse(app.extra_data) : (app.extra_data || {});
            } catch (e) {
                extraData = {};
            }
            
            // Get field labels mapping (if saved)
            const fieldLabels = extraData._fieldLabels || {};
            
            // System/internal fields to exclude from display
            const hiddenFields = ['discord_oauth', 'discord_global_name', '_fieldLabels', 'brand'];
            
            // Build ALL form answers dynamically
            const allAnswers = Object.entries(extraData)
                .filter(([key]) => !hiddenFields.includes(key))
                .filter(([key, value]) => value !== null && value !== undefined && value !== '')
                .map(([key, value]) => {
                    // Use saved label if available, otherwise format the key nicely
                    let label = fieldLabels[key];
                    if (!label) {
                        label = key
                            .replace(/^field_\d+$/, 'Custom Field')
                            .replace(/^custom_\d+$/, 'Custom Field')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                    }
                    return { key, label, value };
                });
            
            // Render answers HTML
            const renderAnswers = (answers) => answers.map(a => {
                let displayValue = a.value;
                if (typeof displayValue === 'string' && displayValue.startsWith('http')) {
                    displayValue = `<a href="${displayValue}" target="_blank" style="color: var(--accent);">View Link →</a>`;
                }
                if (typeof displayValue === 'boolean') {
                    displayValue = displayValue ? '✅ Yes' : '❌ No';
                }
                return `
                    <div style="padding: 12px 0; border-bottom: 1px solid var(--border-light);">
                        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${a.label}</div>
                        <div style="color: var(--text-primary);">${displayValue || '-'}</div>
                    </div>
                `;
            }).join('');
            
            // Get the modal body and rebuild it dynamically
            const modal = document.getElementById('applicationModal');
            const modalBody = modal.querySelector('.modal-body');
            
            // Discord avatar HTML
            const discordAvatarHtml = app.discord_avatar 
                ? `<img src="${app.discord_avatar}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">` 
                : '<span style="color: white; font-size: 1.25rem;">👤</span>';
            
            modalBody.innerHTML = `
                <input type="hidden" id="appId" value="${app.id}">
                
                <!-- Applicant Header -->
                <div style="padding: 20px 24px; background: var(--bg-secondary); border-bottom: 1px solid var(--border-light);">
                    <div style="display: flex; align-items: center; gap: 16px;">
                        <div style="width: 60px; height: 60px; background: var(--accent-dim); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; overflow: hidden;">
                            ${app.discord_avatar ? `<img src="${app.discord_avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : '👤'}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 700; font-size: 1.25rem; color: var(--text-primary);">${app.full_name || extraData.full_name || 'Unknown'}</div>
                            <div style="display: flex; gap: 12px; margin-top: 4px; flex-wrap: wrap;">
                                ${app.email ? `<span style="font-size: 0.85rem; color: var(--text-muted);">${app.email}</span>` : ''}
                                ${app.phone ? `<span style="font-size: 0.85rem; color: var(--text-muted);">${app.phone}</span>` : ''}
                            </div>
                        </div>
                        <div class="badge badge-primary" style="font-size: 0.9rem; padding: 8px 16px;">${BRAND_DISPLAY[app.brand] || app.brand}</div>
                    </div>
                </div>
                
                <!-- TikTok Info -->
                ${app.tiktok_handle ? `
                <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">TikTok Profile</div>
                    <div style="display: flex; align-items: center; gap: 16px; background: var(--bg-secondary); padding: 16px; border-radius: 12px;">
                        <a href="https://tiktok.com/@${app.tiktok_handle}" target="_blank" style="font-weight: 600; font-size: 1.1rem; color: var(--accent);">@${app.tiktok_handle}</a>
                        <div style="display: flex; gap: 8px; margin-left: auto;">
                            ${app.follower_count ? `<span class="badge" style="background: var(--bg-card); color: var(--text-secondary);">${app.follower_count} followers</span>` : ''}
                            ${app.avg_views ? `<span class="badge" style="background: var(--bg-card); color: var(--text-secondary);">${app.avg_views} avg views</span>` : ''}
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <!-- Discord Info -->
                ${app.discord_username || app.discord_id ? `
                <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Discord</div>
                    <div style="display: flex; align-items: center; gap: 16px; background: var(--bg-secondary); padding: 16px; border-radius: 12px;">
                        <div style="width: 40px; height: 40px; border-radius: 50%; background: #5865F2; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                            ${discordAvatarHtml}
                        </div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: var(--text-primary);">${app.discord_username || 'Unknown'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">ID: ${app.discord_id || 'N/A'}</div>
                        </div>
                        ${app.discord_id ? `<span class="badge" style="background: rgba(88, 101, 242, 0.15); color: #5865F2; border: 1px solid #5865F2;">✓ OAUTH VERIFIED</span>` : ''}
                    </div>
                </div>
                ` : ''}
                
                <!-- Form Answers -->
                <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light);">
                    <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Form Answers</div>
                    ${allAnswers.length > 0 ? renderAnswers(allAnswers) : '<div style="color: var(--text-muted); font-style: italic;">No additional form data</div>'}
                </div>
                
                <!-- Admin Controls -->
                <div style="padding: 20px 24px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                        <div>
                            <label style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Status</label>
                            <select id="appStatus" class="form-input" onchange="toggleAcceptOptions()" style="width: 100%;">
                                <option value="pending" ${app.status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                                <option value="reviewing" ${app.status === 'reviewing' ? 'selected' : ''}>👀 Reviewing</option>
                                <option value="accepted" ${app.status === 'accepted' ? 'selected' : ''}>✅ Accepted</option>
                                <option value="rejected" ${app.status === 'rejected' ? 'selected' : ''}>❌ Rejected</option>
                                <option value="waitlist" ${app.status === 'waitlist' ? 'selected' : ''}>📋 Waitlist</option>
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; display: block;">Admin Notes</label>
                            <input type="text" id="appNotes" class="form-input" placeholder="Add a note..." value="${app.admin_notes || ''}" style="width: 100%;">
                        </div>
                    </div>
                    
                    <div id="acceptOptions" style="display: ${app.status === 'accepted' ? 'block' : 'none'}; margin-top: 16px; padding: 16px; background: var(--success-dim); border-radius: 12px;">
                        <div style="font-size: 0.85rem; color: var(--success); margin-bottom: 8px;">✅ Accepting will create a managed creator record</div>
                    </div>
                </div>
                
                <!-- Footer Actions -->
                <div style="padding: 16px 24px; background: var(--bg-secondary); border-top: 1px solid var(--border-light); display: flex; gap: 12px; justify-content: space-between;">
                    <button class="btn btn-danger" onclick="quickRejectApplication()">🗑️ Reject</button>
                    <div style="display: flex; gap: 12px;">
                        <button class="btn" onclick="closeApplicationModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="saveApplicationChanges()">💾 Save Changes</button>
                        <button class="btn btn-success" onclick="quickAcceptApplication()">✅ Accept</button>
                    </div>
                </div>
            `;
            
            modal.classList.add('show');
        }
        
        function toggleAcceptOptions() {
            const status = document.getElementById('appStatus').value;
            document.getElementById('acceptOptions').style.display = status === 'accepted' ? 'block' : 'none';
        }
        
        // Add event listener for status change
        document.addEventListener('DOMContentLoaded', () => {
            const appStatusEl = document.getElementById('appStatus');
            if (appStatusEl) {
                appStatusEl.addEventListener('change', toggleAcceptOptions);
            }
        });
        
        async function saveApplicationChanges() {
            const appId = document.getElementById('appId').value;
            const status = document.getElementById('appStatus').value;
            const notes = document.getElementById('appNotes').value;
            
            try {
                const app = allApplications.find(a => a.id === appId);
                
                // Update application
                const { error } = await supabaseClient
                    .from('creator_applications')
                    .update({
                        status,
                        admin_notes: notes,
                        reviewed_by: adminName || 'Admin',
                        reviewed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', appId);
                    
                if (error) throw error;
                
                // Sync status with managed_creators
                if (app?.discord_id) {
                    const managedCreatorStatus = status === 'accepted' ? 'Active' 
                        : status === 'rejected' ? 'Inactive'
                        : status === 'reviewing' ? 'Pending'
                        : 'Applied';
                    
                    // Check if managed_creators record exists
                    const { data: existing } = await supabaseClient
                        .from('managed_creators')
                        .select('id')
                        .eq('discord_id', app.discord_id)
                        .eq('brand', app.brand)
                        .single();
                    
                    if (existing) {
                        // Update existing record status
                        await supabaseClient
                            .from('managed_creators')
                            .update({ 
                                status: managedCreatorStatus,
                                ...(status === 'accepted' ? { joined_at: new Date().toISOString() } : {})
                            })
                            .eq('id', existing.id);
                    }
                }
                
                // If accepted, add to roster (handles both update and create)
                if (status === 'accepted' && app) {
                    await addApplicationToRoster(app);
                }
                
                showToast('Application updated!', 'success');
                logActivity('edit', `Updated application: ${app?.full_name} (${status})`, app?.brand);
                closeApplicationModal();
                loadApplicationsData();
            } catch (err) {
                console.error('Error saving application:', err);
                showToast('Failed to save changes', 'error');
            }
        }
        
        // Unified function to add application to managed_creators
        async function addApplicationToRoster(app) {
            const commissionRate = parseFloat(document.getElementById('appCommissionRate')?.value || 10);
            const creatorRole = document.getElementById('appCreatorRole')?.value || 'Incubator';
            
            try {
                // Get discord name (prefer OAuth username)
                const discordName = app.discord_username || app.discord_name;
                const tiktokHandle = normalizeTikTok(app.tiktok_handle);
                
                // First, check for existing record by discord_id + brand (from new application flow)
                let existing = null;
                if (app.discord_id) {
                    const { data } = await supabaseClient
                        .from('managed_creators')
                        .select('id, discord_id, status')
                        .eq('discord_id', app.discord_id)
                        .eq('brand', app.brand)
                        .single();
                    existing = data;
                }
                
                // Fallback: check by tiktok + brand (for legacy data)
                if (!existing && tiktokHandle) {
                    const { data } = await supabaseClient
                        .from('managed_creators')
                        .select('id, discord_id, status')
                        .eq('account_1', tiktokHandle)
                        .eq('brand', app.brand)
                        .single();
                    existing = data;
                }
                
                let managedCreatorId;
                
                if (existing) {
                    // Update existing record (could be Applied, Pending, or even Inactive being reactivated)
                    const { error: updateError } = await supabaseClient
                        .from('managed_creators')
                        .update({
                            discord_id: app.discord_id || existing.discord_id,
                            discord_name: discordName || undefined,
                            discord_avatar: app.discord_avatar || undefined,
                            email: app.email || undefined,
                            real_name: app.full_name || undefined,
                            application_id: app.id,
                            status: 'Active',
                            role: creatorRole,
                            joined_at: new Date().toISOString()
                        })
                        .eq('id', existing.id);
                    
                    if (updateError) throw updateError;
                    managedCreatorId = existing.id;
                    
                    const wasApplied = existing.status === 'Applied' || existing.status === 'Pending';
                    showToast(wasApplied ? `${app.full_name} approved!` : 'Creator updated in roster', 'success');
                } else {
                    // Create new managed_creator (legacy flow - shouldn't happen with new applications)
                    const { data: newCreator, error: insertError } = await supabaseClient
                        .from('managed_creators')
                        .insert({
                            real_name: app.full_name || null,
                            discord_name: normalizeDiscord(discordName) || null,
                            discord_id: app.discord_id || null,
                            discord_avatar: app.discord_avatar || null,
                            email: app.email || null,
                            brand: app.brand || 'catakor',
                            role: creatorRole,
                            status: 'Active',
                            account_1: tiktokHandle,
                            application_id: app.id,
                            joined_at: new Date().toISOString(),
                            notes: `Created from application on ${new Date().toLocaleDateString()}${app.discord_id ? ' (Discord OAuth)' : ''}`
                        })
                        .select()
                        .single();
                    
                    if (insertError) throw insertError;
                    managedCreatorId = newCreator.id;
                    showToast(`${app.full_name} added to roster!`, 'success');
                }
                
                // Update application with managed_creator_id
                await supabaseClient
                    .from('creator_applications')
                    .update({ managed_creator_id: managedCreatorId })
                    .eq('id', app.id);
                
                logActivity('edit', `Added ${app.full_name} (@${app.tiktok_handle}) to roster`, app.brand);
                
                return managedCreatorId;
            } catch (err) {
                console.error('Error adding to roster:', err);
                showToast('Failed to add to roster', 'error');
                return null;
            }
        }
        
        async function quickAcceptFromTable(appId) {
            const app = allApplications.find(a => a.id === appId);
            if (!app) return;
            
            // Check for Discord
            const hasDiscord = app.discord_username || app.discord_name || app.discord_id;
            if (!hasDiscord) {
                showToast('Cannot accept: Missing Discord username', 'error');
                return;
            }
            
            if (!confirm(`Accept ${app.full_name} (@${app.tiktok_handle}) and add to ${BRAND_DISPLAY[app.brand]} roster?`)) return;
            
            try {
                // Update application status
                await supabaseClient
                    .from('creator_applications')
                    .update({
                        status: 'accepted',
                        reviewed_by: adminName || 'Admin',
                        reviewed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', appId);
                
                // Add to managed_creators using unified function
                await addApplicationToRoster(app);
                
                showToast(`${app.full_name} accepted and added to roster!`, 'success');
                logActivity('edit', `Accepted application: ${app.full_name} (@${app.tiktok_handle})`, app.brand);
                loadApplicationsData();
                await loadManagedCreators();
            } catch (err) {
                console.error('Error accepting application:', err);
                showToast('Failed to accept application', 'error');
            }
        }
        
        async function quickRejectFromTable(appId) {
            const app = allApplications.find(a => a.id === appId);
            if (!app) return;
            
            if (!confirm(`Reject application from ${app.full_name}?`)) return;
            
            try {
                await supabaseClient
                    .from('creator_applications')
                    .update({
                        status: 'rejected',
                        reviewed_by: adminName || 'Admin',
                        reviewed_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', appId);
                
                showToast('Application rejected', 'warning');
                logActivity('edit', `Rejected application: ${app.full_name}`, app.brand);
                loadApplicationsData();
            } catch (err) {
                console.error('Error rejecting application:', err);
                showToast('Failed to reject application', 'error');
            }
        }
        
        async function quickAcceptApplication() {
            const appId = document.getElementById('appId').value;
            document.getElementById('appStatus').value = 'accepted';
            await saveApplicationChanges();
        }
        
        async function quickRejectApplication() {
            const appId = document.getElementById('appId').value;
            const app = allApplications.find(a => a.id === appId);
            
            if (!confirm(`Reject application from ${app?.full_name}?`)) return;
            
            document.getElementById('appStatus').value = 'rejected';
            await saveApplicationChanges();
        }
        
        function copyApplicationLink() {
            const brandFilter = document.getElementById('appBrandFilter')?.value;
            let link = window.location.origin + '/apply.html';
            if (brandFilter && brandFilter !== 'all') {
                link += '?brand=' + brandFilter;
            }
            
            navigator.clipboard.writeText(link).then(() => {
                showToast('Application link copied!', 'success');
            }).catch(() => {
                showToast('Failed to copy link', 'error');
            });
        }
        
        function toggleApplyLinksDropdown() {
            const dropdown = document.getElementById('applyLinksDropdown');
            const isOpen = dropdown.style.display === 'block';
            dropdown.style.display = isOpen ? 'none' : 'block';
            
            // Close on click outside
            if (!isOpen) {
                setTimeout(() => {
                    document.addEventListener('click', closeApplyLinksDropdown);
                }, 10);
            }
        }
        
        function closeApplyLinksDropdown(e) {
            const dropdown = document.getElementById('applyLinksDropdown');
            if (!e.target.closest('.dropdown')) {
                dropdown.style.display = 'none';
                document.removeEventListener('click', closeApplyLinksDropdown);
            }
        }
        
        function copyBrandLink(brand) {
            let link = window.location.origin + '/apply.html';
            if (brand) {
                link += '?brand=' + brand;
            }
            
            navigator.clipboard.writeText(link).then(() => {
                const brandName = brand ? (BRAND_DISPLAY[brand] || brand) : 'Generic';
                showToast(`${brandName} link copied!`, 'success');
                document.getElementById('applyLinksDropdown').style.display = 'none';
            }).catch(() => {
                showToast('Failed to copy link', 'error');
            });
        }
        
        async function loadPendingAppsCount() {
            try {
                const { data, error } = await supabaseClient
                    .from('creator_applications')
                    .select('id')
                    .eq('status', 'pending');
                if (!error && data) {
                    const pending = data.length;
                    const badge = document.getElementById('pendingAppsBadge');
                    if (badge) {
                        badge.textContent = pending;
                        badge.style.display = pending > 0 ? 'inline-block' : 'none';
                    }
                }
            } catch (err) {
                console.error('Error loading pending apps count:', err);
            }
        }

        // Update loadViewData to include new views
        const originalLoadViewData = loadViewData;
        window.loadViewData = function() {
            switch(currentView) {
                case 'payments': loadPaymentsData(); return;
                case 'activity': loadActivityData(); return;
                case 'users': loadUsersData(); return;
                case 'applications': loadApplicationsData(); return;
                case 'datastatus': loadDataHealth(); return;
            }
            originalLoadViewData();
        };

        // Load freshness on init
        const originalInit = init;
        window.init = async function() {
            await originalInit();
            loadBrandFreshness();
            // Load pending counts for badges
            loadPendingUsersCount();
            loadPendingAppsCount();
        };
        
        async function loadPendingUsersCount() {
            try {
                const { data, error } = await supabaseClient
                    .from('user_profiles')
                    .select('id, status')
                    .or('status.is.null,status.eq.pending');
                if (!error && data) {
                    const pending = data.length;
                    const badge = document.getElementById('pendingUsersBadge');
                    if (badge) {
                        badge.textContent = pending;
                        badge.style.display = pending > 0 ? 'inline-block' : 'none';
                    }
                }
            } catch (err) {
                console.error('Error loading pending count:', err);
            }
        }

        // ==================== PORTAL CONFIG ====================
        
        function switchConfigTab(tab) {
            // Update buttons
            document.querySelectorAll('#view-portalconfig .period-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tab);
            });
            
            // Show/hide tabs
            document.querySelectorAll('.config-tab').forEach(t => t.style.display = 'none');
            document.getElementById(`config${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`).style.display = 'block';
            
            // Load data for tab
            if (tab === 'campaigns') loadCampaigns();
            if (tab === 'faq') loadFaqItems();
            if (tab === 'resources') loadResources();
        }
        
        // ========== CAMPAIGNS ==========
        
        async function loadCampaigns() {
            const tbody = document.getElementById('campaignsTableBody');
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Loading...</td></tr>';
            
            const { data, error } = await supabaseClient
                .from('brand_campaigns')
                .select('*')
                .order('display_order', { ascending: true });
            
            if (error) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--danger);">
                    Error loading campaigns. Table may not exist yet.<br>
                    <button class="btn btn-sm" style="margin-top: 8px;" onclick="window.open('sql/brand_campaigns.sql', '_blank')">View SQL Migration</button>
                </td></tr>`;
                return;
            }
            
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">No campaigns found. Add your first campaign!</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.map(c => `
                <tr>
                    <td style="text-align: center; font-size: 1.5rem;">${c.icon || '🏷️'}</td>
                    <td><code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">${c.brand}</code></td>
                    <td><strong>${c.name}</strong><br><span style="font-size: 0.8rem; color: var(--text-muted);">${c.description || ''}</span></td>
                    <td>${c.commission_text || '-'}</td>
                    <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${c.discord_url ? `<a href="${c.discord_url}" target="_blank" style="color: var(--accent);">🔗 Link</a>` : '-'}
                    </td>
                    <td style="text-align: center;">
                        ${c.active 
                            ? '<span style="color: var(--success);">✓ Active</span>' 
                            : '<span style="color: var(--text-muted);">Inactive</span>'}
                    </td>
                    <td>
                        <button class="btn btn-sm" onclick="editCampaign('${c.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteCampaign('${c.id}', '${c.name}')">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
        
        function openAddCampaignModal() {
            document.getElementById('campaignModalTitle').textContent = 'Add Campaign';
            document.getElementById('campaignForm').reset();
            document.getElementById('campaignId').value = '';
            document.getElementById('campaignActive').checked = true;
            document.getElementById('campaignColor').value = '#3b82f6';
            document.getElementById('campaignModal').style.display = 'flex';
        }
        
        async function editCampaign(id) {
            const { data, error } = await supabaseClient
                .from('brand_campaigns')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error || !data) {
                showToast('Failed to load campaign', 'error');
                return;
            }
            
            document.getElementById('campaignModalTitle').textContent = 'Edit Campaign';
            document.getElementById('campaignId').value = data.id;
            document.getElementById('campaignBrand').value = data.brand || '';
            document.getElementById('campaignName').value = data.name || '';
            document.getElementById('campaignDescription').value = data.description || '';
            document.getElementById('campaignCommission').value = data.commission_text || '';
            document.getElementById('campaignIcon').value = data.icon || '';
            document.getElementById('campaignColor').value = data.color || '#3b82f6';
            document.getElementById('campaignApplyUrl').value = data.apply_url || '';
            document.getElementById('campaignDiscordUrl').value = data.discord_url || '';
            document.getElementById('campaignOrder').value = data.display_order || 0;
            document.getElementById('campaignActive').checked = data.active !== false;
            document.getElementById('campaignModal').style.display = 'flex';
        }
        
        function closeCampaignModal() {
            document.getElementById('campaignModal').style.display = 'none';
        }
        
        async function saveCampaign(event) {
            event.preventDefault();
            
            const id = document.getElementById('campaignId').value;
            const campaignData = {
                brand: document.getElementById('campaignBrand').value.trim().toLowerCase(),
                name: document.getElementById('campaignName').value.trim(),
                description: document.getElementById('campaignDescription').value.trim(),
                commission_text: document.getElementById('campaignCommission').value.trim(),
                icon: document.getElementById('campaignIcon').value.trim() || '🏷️',
                color: document.getElementById('campaignColor').value,
                apply_url: document.getElementById('campaignApplyUrl').value.trim() || `apply.html?brand=${document.getElementById('campaignBrand').value.trim().toLowerCase()}`,
                discord_url: document.getElementById('campaignDiscordUrl').value.trim(),
                display_order: parseInt(document.getElementById('campaignOrder').value) || 0,
                active: document.getElementById('campaignActive').checked,
                updated_at: new Date().toISOString()
            };
            
            let error;
            if (id) {
                ({ error } = await supabaseClient.from('brand_campaigns').update(campaignData).eq('id', id));
            } else {
                ({ error } = await supabaseClient.from('brand_campaigns').insert(campaignData));
            }
            
            if (error) {
                showToast('Failed to save campaign: ' + error.message, 'error');
                return;
            }
            
            showToast('Campaign saved!', 'success');
            closeCampaignModal();
            loadCampaigns();
        }
        
        async function deleteCampaign(id, name) {
            if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return;
            
            const { error } = await supabaseClient.from('brand_campaigns').delete().eq('id', id);
            
            if (error) {
                showToast('Failed to delete campaign', 'error');
                return;
            }
            
            showToast('Campaign deleted', 'success');
            loadCampaigns();
        }
        
        // ========== FAQ ==========
        
        async function loadFaqItems() {
            const container = document.getElementById('faqItemsList');
            container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading...</div>';
            
            const { data, error } = await supabaseClient
                .from('portal_faq')
                .select('*')
                .order('display_order', { ascending: true });
            
            if (error) {
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger);">
                    Error loading FAQ. Table may not exist yet.<br>
                    <button class="btn btn-sm" style="margin-top: 8px;" onclick="window.open('sql/brand_campaigns.sql', '_blank')">View SQL Migration</button>
                </div>`;
                return;
            }
            
            if (!data || data.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No FAQ items found. Add your first question!</div>';
                return;
            }
            
            container.innerHTML = data.map(f => `
                <div style="display: flex; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px; align-items: flex-start;">
                    <div style="font-size: 1.5rem;">${f.icon || '❓'}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${f.question}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">${f.answer}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">
                            Order: ${f.display_order || 0} • ${f.active ? '<span style="color: var(--success);">Active</span>' : '<span style="color: var(--text-muted);">Inactive</span>'}
                        </div>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-sm" onclick="editFaq('${f.id}')">✏️</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteFaq('${f.id}')">🗑️</button>
                    </div>
                </div>
            `).join('');
        }
        
        function openAddFaqModal() {
            document.getElementById('faqModalTitle').textContent = 'Add FAQ';
            document.getElementById('faqForm').reset();
            document.getElementById('faqId').value = '';
            document.getElementById('faqActive').checked = true;
            document.getElementById('faqModal').style.display = 'flex';
        }
        
        async function editFaq(id) {
            const { data, error } = await supabaseClient
                .from('portal_faq')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error || !data) {
                showToast('Failed to load FAQ', 'error');
                return;
            }
            
            document.getElementById('faqModalTitle').textContent = 'Edit FAQ';
            document.getElementById('faqId').value = data.id;
            document.getElementById('faqIcon').value = data.icon || '';
            document.getElementById('faqQuestion').value = data.question || '';
            document.getElementById('faqAnswer').value = data.answer || '';
            document.getElementById('faqOrder').value = data.display_order || 0;
            document.getElementById('faqActive').checked = data.active !== false;
            document.getElementById('faqModal').style.display = 'flex';
        }
        
        function closeFaqModal() {
            document.getElementById('faqModal').style.display = 'none';
        }
        
        async function saveFaq(event) {
            event.preventDefault();
            
            const id = document.getElementById('faqId').value;
            const faqData = {
                icon: document.getElementById('faqIcon').value.trim() || '❓',
                question: document.getElementById('faqQuestion').value.trim(),
                answer: document.getElementById('faqAnswer').value.trim(),
                display_order: parseInt(document.getElementById('faqOrder').value) || 0,
                active: document.getElementById('faqActive').checked,
                updated_at: new Date().toISOString()
            };
            
            let error;
            if (id) {
                ({ error } = await supabaseClient.from('portal_faq').update(faqData).eq('id', id));
            } else {
                ({ error } = await supabaseClient.from('portal_faq').insert(faqData));
            }
            
            if (error) {
                showToast('Failed to save FAQ: ' + error.message, 'error');
                return;
            }
            
            showToast('FAQ saved!', 'success');
            closeFaqModal();
            loadFaqItems();
        }
        
        async function deleteFaq(id) {
            if (!confirm('Delete this FAQ item?')) return;
            
            const { error } = await supabaseClient.from('portal_faq').delete().eq('id', id);
            
            if (error) {
                showToast('Failed to delete FAQ', 'error');
                return;
            }
            
            showToast('FAQ deleted', 'success');
            loadFaqItems();
        }
        
        // ========== RESOURCES ==========
        
        async function loadResources() {
            const container = document.getElementById('resourcesList');
            container.innerHTML = '<div style="text-align: center; padding: 20px;">Loading...</div>';
            
            const { data, error } = await supabaseClient
                .from('portal_resources')
                .select('*')
                .order('display_order', { ascending: true });
            
            if (error) {
                container.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--danger);">
                    Error loading resources. Table may not exist yet.<br>
                    <button class="btn btn-sm" style="margin-top: 8px;" onclick="window.open('sql/brand_campaigns.sql', '_blank')">View SQL Migration</button>
                </div>`;
                return;
            }
            
            if (!data || data.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No resources found. Add your first resource!</div>';
                return;
            }
            
            const fileTypeIcons = { pdf: '📄', doc: '📝', image: '🖼️', video: '🎬', other: '📎' };
            
            container.innerHTML = data.map(r => `
                <div style="display: flex; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px; align-items: center;">
                    <div style="font-size: 1.5rem;">${r.icon || fileTypeIcons[r.file_type] || '📄'}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${r.title}</div>
                        ${r.description ? `<div style="font-size: 0.85rem; color: var(--text-secondary);">${r.description}</div>` : ''}
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                            ${r.file_type?.toUpperCase() || 'FILE'} • ${r.brand || 'All Brands'} • ${r.active ? '<span style="color: var(--success);">Active</span>' : '<span style="color: var(--text-muted);">Inactive</span>'}
                        </div>
                    </div>
                    <a href="${r.file_url}" target="_blank" class="btn btn-sm">👁️ View</a>
                    <button class="btn btn-sm" onclick="editResource('${r.id}')">✏️</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteResource('${r.id}')">🗑️</button>
                </div>
            `).join('');
        }
        
        function openAddResourceModal() {
            document.getElementById('resourceModalTitle').textContent = 'Add Resource';
            document.getElementById('resourceForm').reset();
            document.getElementById('resourceId').value = '';
            document.getElementById('resourceActive').checked = true;
            document.getElementById('resourceModal').style.display = 'flex';
        }
        
        async function editResource(id) {
            const { data, error } = await supabaseClient
                .from('portal_resources')
                .select('*')
                .eq('id', id)
                .single();
            
            if (error || !data) {
                showToast('Failed to load resource', 'error');
                return;
            }
            
            document.getElementById('resourceModalTitle').textContent = 'Edit Resource';
            document.getElementById('resourceId').value = data.id;
            document.getElementById('resourceTitle').value = data.title || '';
            document.getElementById('resourceDescription').value = data.description || '';
            document.getElementById('resourceFileUrl').value = data.file_url || '';
            document.getElementById('resourceIcon').value = data.icon || '';
            document.getElementById('resourceFileType').value = data.file_type || 'pdf';
            document.getElementById('resourceBrand').value = data.brand || '';
            document.getElementById('resourceOrder').value = data.display_order || 0;
            document.getElementById('resourceActive').checked = data.active !== false;
            document.getElementById('resourceModal').style.display = 'flex';
        }
        
        function closeResourceModal() {
            document.getElementById('resourceModal').style.display = 'none';
        }
        
        async function saveResource(event) {
            event.preventDefault();
            
            const id = document.getElementById('resourceId').value;
            const resourceData = {
                title: document.getElementById('resourceTitle').value.trim(),
                description: document.getElementById('resourceDescription').value.trim(),
                file_url: document.getElementById('resourceFileUrl').value.trim(),
                icon: document.getElementById('resourceIcon').value.trim() || '📄',
                file_type: document.getElementById('resourceFileType').value,
                brand: document.getElementById('resourceBrand').value || null,
                display_order: parseInt(document.getElementById('resourceOrder').value) || 0,
                active: document.getElementById('resourceActive').checked,
                updated_at: new Date().toISOString()
            };
            
            let error;
            if (id) {
                ({ error } = await supabaseClient.from('portal_resources').update(resourceData).eq('id', id));
            } else {
                ({ error } = await supabaseClient.from('portal_resources').insert(resourceData));
            }
            
            if (error) {
                showToast('Failed to save resource: ' + error.message, 'error');
                return;
            }
            
            showToast('Resource saved!', 'success');
            closeResourceModal();
            loadResources();
        }
        
        async function deleteResource(id) {
            if (!confirm('Delete this resource?')) return;
            
            const { error } = await supabaseClient.from('portal_resources').delete().eq('id', id);
            
            if (error) {
                showToast('Failed to delete resource', 'error');
                return;
            }
            
            showToast('Resource deleted', 'success');
            loadResources();
        }

        // ==================== APPLICATION FUNNEL BUILDER ====================
        
        let currentFunnel = {
            id: null,
            name: '',
            slug: '',
            brand: null,
            status: 'draft',
            steps: [
                { id: 'step1', title: 'Your Info', icon: '👤' },
                { id: 'step2', title: 'TikTok Profile', icon: '📱' },
                { id: 'step3', title: 'Application', icon: '🎯' }
            ],
            fields: [],
            settings: {
                header_title: 'Apply to Join Our Creator Network',
                header_subtitle: 'Partner with top brands and earn commissions',
                primary_color: '#f5c518',
                success_title: 'Application Received! 🎉',
                success_message: 'We\'ll review your application and get back to you within 48 hours.'
            }
        };
        
        async function loadFunnelsData() {
            try {
                const { data, error } = await supabaseClient
                    .from('application_funnels')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                renderFunnelsGrid(data || []);
            } catch (err) {
                console.error('Error loading funnels:', err);
                document.getElementById('funnelsTableBody').innerHTML = `
                    <tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">
                        Failed to load funnels. <button class="btn btn-sm" onclick="loadFunnelsData()">Retry</button>
                    </td></tr>`;
            }
        }
        
        function renderFunnelsGrid(funnels) {
            const grid = document.getElementById('funnelsGrid');
            if (!funnels || funnels.length === 0) {
                grid.innerHTML = `
                    <div style="text-align: center; padding: 60px;">
                        <div style="font-size: 4rem; margin-bottom: 16px;">🚀</div>
                        <h3 style="font-size: 1.25rem; margin-bottom: 8px;">No Funnels Yet</h3>
                        <p style="color: var(--text-muted); margin-bottom: 24px;">Create your first application funnel to start collecting creator applications</p>
                        <button class="btn btn-primary" onclick="openFunnelBuilder()">➕ Create Your First Funnel</button>
                    </div>`;
                return;
            }
            
            const statusBadge = (status) => {
                const styles = { 
                    active: 'background: var(--success-dim); color: var(--success);', 
                    draft: 'background: var(--warning-dim); color: var(--warning);', 
                    archived: 'background: var(--bg-secondary); color: var(--text-muted);' 
                };
                const labels = { active: 'Active', draft: 'Draft', archived: 'Archived' };
                return `<span style="padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; ${styles[status] || styles.draft}">${labels[status] || status}</span>`;
            };
            
            grid.innerHTML = `
                <table class="data-table" style="width: 100%;">
                    <thead>
                        <tr>
                            <th style="width: 30%;">Funnel</th>
                            <th style="width: 15%;">Brand</th>
                            <th style="width: 10%; text-align: center;">Status</th>
                            <th style="width: 8%; text-align: right;">Views</th>
                            <th style="width: 8%; text-align: right;">Applies</th>
                            <th style="width: 8%; text-align: right;">Rate</th>
                            <th style="width: 21%; text-align: right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${funnels.map(f => {
                            const conversion = f.views > 0 ? ((f.submissions / f.views) * 100).toFixed(1) : '0.0';
                            const brandName = f.brand ? (BRAND_DISPLAY[f.brand] || f.brand) : '—';
                            const link = `${window.location.origin}/apply.html?funnel=${f.slug}`;
                            
                            return `
                                <tr>
                                    <td>
                                        <div style="font-weight: 600;">${f.name}</div>
                                        <div style="font-size: 0.8rem; color: var(--text-muted);">/apply.html?funnel=${f.slug}</div>
                                    </td>
                                    <td>${brandName}</td>
                                    <td style="text-align: center;">${statusBadge(f.status)}</td>
                                    <td style="text-align: right; font-weight: 500;">${(f.views || 0).toLocaleString()}</td>
                                    <td style="text-align: right; font-weight: 500;">${(f.submissions || 0).toLocaleString()}</td>
                                    <td style="text-align: right; font-weight: 500; color: ${parseFloat(conversion) > 5 ? 'var(--success)' : 'var(--text-secondary)'};">${conversion}%</td>
                                    <td style="text-align: right;">
                                        <div style="display: flex; gap: 4px; justify-content: flex-end;">
                                            <button class="btn btn-sm" onclick="editFunnel('${f.id}')" title="Edit">✏️</button>
                                            <button class="btn btn-sm" onclick="copyFunnelLink('${f.slug}')" title="Copy Link">🔗</button>
                                            <button class="btn btn-sm" onclick="window.open('${link}', '_blank')" title="Preview">👁️</button>
                                            <button class="btn btn-sm" onclick="duplicateFunnel('${f.id}')" title="Duplicate">📋</button>
                                            <button class="btn btn-sm" onclick="deleteFunnel('${f.id}')" title="Delete" style="color: var(--danger);">🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }
        
        function copyFunnelLink(slug) {
            const link = `${window.location.origin}/apply.html?funnel=${slug}`;
            navigator.clipboard.writeText(link).then(() => {
                showToast('Link copied!', 'success');
            });
        }
        
        function openFunnelBuilder(funnelId = null) {
            // Reset to default if creating new
            if (!funnelId) {
                currentFunnel = {
                    id: null,
                    name: '',
                    slug: '',
                    brand: null,
                    status: 'draft',
                    steps: [
                        { id: 'step1', title: 'Your Info', icon: '👤' },
                        { id: 'step2', title: 'TikTok Profile', icon: '📱' },
                        { id: 'step3', title: 'Application', icon: '🎯' }
                    ],
                    fields: [
                        { id: 'full_name', type: 'text', label: 'Full Name', required: true, step: 'step1', placeholder: 'Your full name', width: 'full' },
                        { id: 'email', type: 'email', label: 'Email', required: true, step: 'step1', placeholder: 'you@email.com', width: 'half' },
                        { id: 'discord_name', type: 'text', label: 'Discord Username', required: true, step: 'step1', placeholder: 'username', width: 'half' },
                        { id: 'tiktok_handle', type: 'text', label: 'TikTok Handle', required: true, step: 'step2', placeholder: '@yourusername', width: 'full' },
                        { id: 'follower_count', type: 'select', label: 'Follower Count', required: true, step: 'step2', width: 'half', options: [
                            { value: '0-1k', label: '0 - 1,000' },
                            { value: '1k-5k', label: '1,000 - 5,000' },
                            { value: '5k-10k', label: '5,000 - 10,000' },
                            { value: '10k-50k', label: '10,000 - 50,000' },
                            { value: '50k+', label: '50,000+' }
                        ]},
                        { id: 'brand', type: 'select', label: 'Which brand?', required: true, step: 'step3', width: 'full', options: [
                            { value: 'catakor', label: 'Cata-Kor' },
                            { value: 'jiyu', label: 'JiYu' },
                            { value: 'physicians_choice', label: 'Physicians Choice' },
                            { value: 'peach_slices', label: 'Peach Slices' },
                            { value: 'yerba_magic', label: 'Yerba Magic' }
                        ]}
                    ],
                    settings: {
                        header_title: 'Apply to Join Our Creator Network',
                        header_subtitle: 'Partner with top brands and earn commissions',
                        primary_color: '#f5c518',
                        success_title: 'Application Received! 🎉',
                        success_message: 'We\'ll review your application and get back to you within 48 hours.'
                    }
                };
                document.getElementById('funnelBuilderTitle').textContent = 'Create Application Funnel';
            }
            
            populateFunnelBuilder();
            document.getElementById('funnelBuilderModal').classList.add('show');
        }
        
        function closeFunnelBuilder() {
            document.getElementById('funnelBuilderModal').classList.remove('show');
        }
        
        async function editFunnel(id) {
            try {
                const { data, error } = await supabaseClient
                    .from('application_funnels')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (error) throw error;
                
                currentFunnel = {
                    id: data.id,
                    name: data.name,
                    slug: data.slug,
                    brand: data.brand,
                    status: data.status,
                    steps: data.steps || [],
                    fields: data.fields || [],
                    settings: data.settings || {}
                };
                
                document.getElementById('funnelBuilderTitle').textContent = 'Edit Funnel: ' + data.name;
                populateFunnelBuilder();
                document.getElementById('funnelBuilderModal').classList.add('show');
            } catch (err) {
                console.error('Error loading funnel:', err);
                showToast('Failed to load funnel', 'error');
            }
        }
        
        async function duplicateFunnel(id) {
            try {
                const { data, error } = await supabaseClient
                    .from('application_funnels')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (error) throw error;
                
                const newFunnel = {
                    name: data.name + ' (Copy)',
                    slug: data.slug + '-copy-' + Date.now(),
                    brand: data.brand,
                    status: 'draft',
                    steps: data.steps,
                    fields: data.fields,
                    settings: data.settings
                };
                
                const { error: insertError } = await supabaseClient
                    .from('application_funnels')
                    .insert([newFunnel]);
                
                if (insertError) throw insertError;
                
                showToast('Funnel duplicated!', 'success');
                loadFunnelsData();
            } catch (err) {
                console.error('Error duplicating funnel:', err);
                showToast('Failed to duplicate funnel', 'error');
            }
        }
        
        async function deleteFunnel(id) {
            if (!confirm('Are you sure you want to delete this funnel?')) return;
            
            try {
                const { error } = await supabaseClient
                    .from('application_funnels')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
                
                showToast('Funnel deleted', 'success');
                loadFunnelsData();
            } catch (err) {
                console.error('Error deleting funnel:', err);
                showToast('Failed to delete funnel', 'error');
            }
        }
        
        function populateFunnelBuilder() {
            // Initialize active step
            currentFunnel.activeStep = currentFunnel.steps[0]?.id || 'step1';
            
            // Basic info
            document.getElementById('funnelName').value = currentFunnel.name || '';
            document.getElementById('funnelSlug').value = currentFunnel.slug || '';
            document.getElementById('funnelBrand').value = currentFunnel.brand || '';
            document.getElementById('funnelStatus').value = currentFunnel.status || 'draft';
            
            // Branding
            const settings = currentFunnel.settings || {};
            document.getElementById('funnelPrimaryColor').value = settings.primary_color || '#f5c518';
            document.getElementById('funnelPrimaryColorText').value = settings.primary_color || '#f5c518';
            document.getElementById('funnelHeaderTitle').value = settings.header_title || '';
            document.getElementById('funnelHeaderSubtitle').value = settings.header_subtitle || '';
            document.getElementById('funnelLogoUrl').value = settings.logo_url || '';
            document.getElementById('funnelWelcomeVideo').value = settings.welcome_video_url || '';
            
            // Settings
            document.getElementById('funnelSuccessTitle').value = settings.success_title || '';
            document.getElementById('funnelSuccessMessage').value = settings.success_message || '';
            document.getElementById('funnelThankYouVideo').value = settings.thank_you_video_url || '';
            document.getElementById('funnelDiscordOAuth').checked = settings.discord_oauth_enabled || false;
            document.getElementById('funnelDiscordClientId').value = settings.discord_client_id || '';
            document.getElementById('funnelDiscordLink').value = settings.discord_server_link || '';
            
            // Toggle Discord settings visibility
            toggleDiscordSettings();
            
            // Render fields and steps
            renderStepsTabs();
            renderFieldsList();
            updateFunnelPreview();
        }
        
        function toggleDiscordSettings() {
            const enabled = document.getElementById('funnelDiscordOAuth').checked;
            document.getElementById('discordOAuthSettings').style.display = enabled ? 'block' : 'none';
        }
        
        function copyDiscordRedirect() {
            const input = document.getElementById('funnelDiscordRedirect');
            input.select();
            document.execCommand('copy');
            showToast('Redirect URI copied!', 'success');
        }
        
        function renderFieldsList() {
            const container = document.getElementById('fieldsList');
            const activeStep = currentFunnel.activeStep || (currentFunnel.steps[0]?.id);
            const fieldsInStep = currentFunnel.fields.filter(f => f.step === activeStep);
            
            const fieldIcons = {
                'text': 'Aa',
                'email': '📧',
                'tel': '📱',
                'tiktok': '🎵',
                'select': '▼',
                'textarea': '📝',
                'number': '#',
                'url': '🔗',
                'checkbox': '☑️'
            };
            
            if (fieldsInStep.length === 0) {
                container.innerHTML = '';
                return;
            }
            
            container.innerHTML = fieldsInStep.map((field, idx) => {
                const globalIdx = currentFunnel.fields.findIndex(f => f.id === field.id);
                const icon = fieldIcons[field.type] || '📋';
                return `
                    <div class="field-item-new" draggable="true" data-idx="${globalIdx}" data-field-id="${field.id}" 
                         ondragstart="dragFieldReorder(event)" ondragover="allowDropReorder(event)" ondrop="dropFieldReorder(event)">
                        <div class="field-icon">${icon}</div>
                        <div class="field-info">
                            <div class="field-label-new">
                                ${field.label}
                                ${field.required ? '<span class="required-badge">Required</span>' : ''}
                            </div>
                            <div class="field-meta-new">${field.type}${field.placeholder ? ' · ' + field.placeholder : ''}</div>
                        </div>
                        <div class="field-actions-new">
                            <button onclick="editField(${globalIdx})" title="Edit">✏️</button>
                            <button onclick="deleteField(${globalIdx})" title="Delete" style="color: var(--danger);">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        function renderStepsTabs() {
            const container = document.getElementById('stepsTabs');
            const activeStep = currentFunnel.activeStep || (currentFunnel.steps[0]?.id);
            
            container.innerHTML = currentFunnel.steps.map((step, idx) => {
                const fieldCount = currentFunnel.fields.filter(f => f.step === step.id).length;
                const isActive = step.id === activeStep;
                const canDelete = currentFunnel.steps.length > 1;
                return `
                    <div class="step-tab ${isActive ? 'active' : ''}" style="position: relative;">
                        <div onclick="switchToStep('${step.id}')" style="display: flex; align-items: center; gap: 6px; flex: 1;">
                            <span>${step.icon}</span>
                            <span>${step.title}</span>
                            <span style="opacity: 0.6; font-size: 0.75rem;">(${fieldCount})</span>
                        </div>
                        ${canDelete ? `<button onclick="event.stopPropagation(); deleteStep(${idx})" style="background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px 6px; font-size: 0.8rem; opacity: 0.6; transition: all 0.2s;" onmouseover="this.style.opacity=1; this.style.color='var(--danger)';" onmouseout="this.style.opacity=0.6; this.style.color='var(--text-muted)';">✕</button>` : ''}
                    </div>
                `;
            }).join('') + `
                <div class="step-tab" onclick="addStep()" style="border-style: dashed; color: var(--text-muted);">
                    + Add Step
                </div>
            `;
        }
        
        function switchToStep(stepId) {
            currentFunnel.activeStep = stepId;
            renderStepsTabs();
            renderFieldsList();
            updateFunnelPreview();
        }
        
        function renderStepsList() {
            // For backwards compatibility, render both formats
            renderStepsTabs();
            
            const container = document.getElementById('stepsList');
            if (!container) return;
            
            container.innerHTML = currentFunnel.steps.map((step, idx) => {
                const fieldCount = currentFunnel.fields.filter(f => f.step === step.id).length;
                return `
                    <div class="step-item" draggable="true" data-idx="${idx}">
                        <span class="drag-handle">⋮⋮</span>
                        <span style="font-size: 1.25rem;">${step.icon}</span>
                        <div style="flex: 1;">
                            <input type="text" value="${step.title}" class="form-input" style="padding: 6px 10px; font-size: 0.9rem;"
                                   onchange="updateStepTitle(${idx}, this.value)">
                            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">${fieldCount} fields</div>
                        </div>
                        <button onclick="deleteStep(${idx})" style="background: none; border: none; cursor: pointer; color: var(--danger);">🗑️</button>
                    </div>
                `;
            }).join('');
        }
        
        // Settings section toggle
        function toggleSettingsSection(section) {
            const content = document.getElementById(`settingsSection-${section}`);
            const isOpen = content.classList.contains('show');
            
            // Close all sections
            document.querySelectorAll('.settings-section-content').forEach(c => c.classList.remove('show'));
            document.querySelectorAll('.settings-toggle').forEach(t => t.textContent = '▼');
            
            // Toggle this one
            if (!isOpen) {
                content.classList.add('show');
                content.previousElementSibling.querySelector('.settings-toggle').textContent = '▲';
            }
        }
        
        // Auto-generate slug from name
        function autoGenerateSlug() {
            const name = document.getElementById('funnelName').value;
            const slug = name.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            document.getElementById('funnelSlug').value = slug;
        }
        
        // Drag and drop for adding new fields from palette
        let draggedFieldType = null;
        
        function dragFieldStart(event, type) {
            draggedFieldType = type;
            event.dataTransfer.setData('text/plain', type);
            event.dataTransfer.effectAllowed = 'copy';
        }
        
        function dragOverField(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            document.getElementById('fieldsDropZone').classList.add('drag-over');
        }
        
        function dragLeaveField(event) {
            document.getElementById('fieldsDropZone').classList.remove('drag-over');
        }
        
        function dropField(event) {
            event.preventDefault();
            document.getElementById('fieldsDropZone').classList.remove('drag-over');
            
            if (draggedFieldType) {
                addFieldOfType(draggedFieldType);
                draggedFieldType = null;
            }
        }
        
        // Drag and drop for reordering fields
        let draggedFieldIdx = null;
        
        function dragFieldReorder(event) {
            draggedFieldIdx = parseInt(event.target.closest('.field-item-new').dataset.idx);
            event.dataTransfer.setData('text/plain', draggedFieldIdx);
            event.dataTransfer.effectAllowed = 'move';
            event.target.closest('.field-item-new').classList.add('dragging');
        }
        
        function allowDropReorder(event) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
        }
        
        function dropFieldReorder(event) {
            event.preventDefault();
            const targetIdx = parseInt(event.target.closest('.field-item-new').dataset.idx);
            
            if (draggedFieldIdx !== null && draggedFieldIdx !== targetIdx) {
                // Reorder fields
                const field = currentFunnel.fields.splice(draggedFieldIdx, 1)[0];
                currentFunnel.fields.splice(targetIdx, 0, field);
                renderFieldsList();
                updateFunnelPreview();
            }
            
            document.querySelectorAll('.field-item-new').forEach(el => el.classList.remove('dragging'));
            draggedFieldIdx = null;
        }
        
        // Preview device switching
        function setPreviewDevice(device) {
            document.querySelectorAll('.preview-device-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector(`.preview-device-btn[onclick*="${device}"]`).classList.add('active');
            
            const preview = document.getElementById('funnelPreview');
            preview.className = device === 'mobile' ? 'preview-mobile' : 'preview-desktop';
        }
        
        function switchFunnelTab(tab) {
            document.querySelectorAll('.funnel-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.funnel-tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector(`.funnel-tab[data-tab="${tab}"]`)?.classList.add('active');
            document.getElementById(`funnelTab-${tab}`)?.classList.add('active');
        }
        
        function addFieldOfType(type) {
            const id = 'field_' + Date.now();
            const labels = {
                text: 'Text Field',
                email: 'Email',
                tel: 'Phone',
                tiktok: 'TikTok Handle',
                url: 'URL',
                number: 'Number',
                select: 'Dropdown',
                textarea: 'Text Area',
                checkbox: 'Checkbox'
            };
            
            const placeholders = {
                text: 'Enter text...',
                email: 'you@email.com',
                tel: '(555) 123-4567',
                tiktok: '@username',
                url: 'https://...',
                number: '0',
                textarea: 'Tell us more...'
            };
            
            const activeStep = currentFunnel.activeStep || currentFunnel.steps[0]?.id || 'step1';
            
            currentFunnel.fields.push({
                id: id,
                type: type,
                label: labels[type] || 'New Field',
                placeholder: placeholders[type] || '',
                required: false,
                step: activeStep,
                placeholder: '',
                width: 'full',
                options: type === 'select' ? [{ value: 'option1', label: 'Option 1' }] : undefined
            });
            
            renderFieldsList();
            updateFunnelPreview();
            
            // Open editor for the new field
            editField(currentFunnel.fields.length - 1);
        }
        
        function addField() {
            addFieldOfType('text');
        }
        
        function editField(idx) {
            const field = currentFunnel.fields[idx];
            if (!field) return;
            
            document.getElementById('editingFieldId').value = idx;
            document.getElementById('fieldLabel').value = field.label || '';
            document.getElementById('fieldId').value = field.id || '';
            document.getElementById('fieldType').value = field.type || 'text';
            document.getElementById('fieldPlaceholder').value = field.placeholder || '';
            document.getElementById('fieldWidth').value = field.width || 'full';
            document.getElementById('fieldRequired').checked = field.required || false;
            
            // Populate step dropdown
            const stepSelect = document.getElementById('fieldStep');
            stepSelect.innerHTML = currentFunnel.steps.map(s => 
                `<option value="${s.id}" ${field.step === s.id ? 'selected' : ''}>${s.icon} ${s.title}</option>`
            ).join('');
            
            // Options for select
            if (field.type === 'select' && field.options) {
                document.getElementById('fieldOptions').value = field.options.map(o => `${o.value}|${o.label}`).join('\n');
            } else {
                document.getElementById('fieldOptions').value = '';
            }
            
            toggleFieldOptions();
            document.getElementById('fieldEditorModal').classList.add('show');
        }
        
        function toggleFieldOptions() {
            const type = document.getElementById('fieldType').value;
            document.getElementById('fieldOptionsGroup').style.display = type === 'select' ? 'block' : 'none';
        }
        
        function closeFieldEditor() {
            document.getElementById('fieldEditorModal').classList.remove('show');
        }
        
        function saveFieldEdit() {
            const idx = parseInt(document.getElementById('editingFieldId').value);
            const field = currentFunnel.fields[idx];
            if (!field) return;
            
            field.label = document.getElementById('fieldLabel').value;
            field.id = document.getElementById('fieldId').value || 'field_' + Date.now();
            field.type = document.getElementById('fieldType').value;
            field.placeholder = document.getElementById('fieldPlaceholder').value;
            field.step = document.getElementById('fieldStep').value;
            field.width = document.getElementById('fieldWidth').value;
            field.required = document.getElementById('fieldRequired').checked;
            
            if (field.type === 'select') {
                const optionsText = document.getElementById('fieldOptions').value;
                field.options = optionsText.split('\n').filter(l => l.trim()).map(line => {
                    const [value, label] = line.split('|');
                    return { value: value?.trim() || '', label: label?.trim() || value?.trim() || '' };
                });
            }
            
            closeFieldEditor();
            renderFieldsList();
            updateFunnelPreview();
        }
        
        function deleteField(idx) {
            currentFunnel.fields.splice(idx, 1);
            renderFieldsList();
            updateFunnelPreview();
        }
        
        function addStep() {
            const id = 'step_' + Date.now();
            const icons = ['📋', '📝', '✨', '🎯', '🚀', '💫', '⭐', '🔥'];
            const icon = icons[currentFunnel.steps.length % icons.length];
            
            currentFunnel.steps.push({
                id: id,
                title: 'Step ' + (currentFunnel.steps.length + 1),
                icon: icon
            });
            
            // Switch to the new step
            currentFunnel.activeStep = id;
            renderStepsTabs();
            renderFieldsList();
            updateFunnelPreview();
        }
        
        function updateStepTitle(idx, title) {
            if (currentFunnel.steps[idx]) {
                currentFunnel.steps[idx].title = title;
                renderStepsTabs();
                updateFunnelPreview();
            }
        }
        
        function deleteStep(idx) {
            if (currentFunnel.steps.length <= 1) {
                showToast('Must have at least one step', 'error');
                return;
            }
            const stepId = currentFunnel.steps[idx].id;
            // Move fields from this step to the first remaining step
            const remainingSteps = currentFunnel.steps.filter((_, i) => i !== idx);
            currentFunnel.fields.forEach(f => {
                if (f.step === stepId) f.step = remainingSteps[0].id;
            });
            currentFunnel.steps.splice(idx, 1);
            
            // Update active step if needed
            if (currentFunnel.activeStep === stepId) {
                currentFunnel.activeStep = currentFunnel.steps[0].id;
            }
            
            renderStepsTabs();
            renderFieldsList();
            updateFunnelPreview();
        }
        
        function updateFunnelPreview() {
            const settings = currentFunnel.settings || {};
            const primaryColor = document.getElementById('funnelPrimaryColor')?.value || settings.primary_color || '#f5c518';
            const headerTitle = document.getElementById('funnelHeaderTitle')?.value || settings.header_title || 'Apply to Join';
            const headerSubtitle = document.getElementById('funnelHeaderSubtitle')?.value || settings.header_subtitle || '';
            const logoUrl = document.getElementById('funnelLogoUrl')?.value || settings.logo_url || '';
            
            const activeStep = currentFunnel.activeStep || currentFunnel.steps[0]?.id;
            const activeStepIdx = currentFunnel.steps.findIndex(s => s.id === activeStep);
            const stepFields = currentFunnel.fields.filter(f => f.step === activeStep);
            
            const preview = document.getElementById('funnelPreview');
            preview.innerHTML = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
                    <!-- Header -->
                    <div style="text-align: center; margin-bottom: 20px;">
                        ${logoUrl ? `<img src="${logoUrl}" style="height: 40px; margin-bottom: 12px;">` : ''}
                        <h2 style="color: ${primaryColor}; font-size: 1.25rem; margin: 0 0 6px 0;">${headerTitle}</h2>
                        ${headerSubtitle ? `<p style="color: #888; font-size: 0.85rem; margin: 0;">${headerSubtitle}</p>` : ''}
                    </div>
                    
                    <!-- Steps Progress -->
                    ${currentFunnel.steps.length > 1 ? `
                        <div style="display: flex; gap: 8px; margin-bottom: 20px;">
                            ${currentFunnel.steps.map((s, i) => `
                                <div style="flex: 1; text-align: center; padding: 8px 4px; border-radius: 6px; font-size: 0.75rem;
                                    ${i === activeStepIdx ? `background: ${primaryColor}; color: #000; font-weight: 600;` : 
                                      i < activeStepIdx ? `background: ${primaryColor}40; color: ${primaryColor};` : 
                                      'background: #222; color: #666;'}">
                                    ${s.icon} ${s.title}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    <!-- Form Fields -->
                    <div style="display: flex; flex-direction: column; gap: 14px;">
                        ${stepFields.length === 0 ? `
                            <div style="text-align: center; padding: 40px 20px; color: #666; font-size: 0.85rem;">
                                <div style="font-size: 2rem; margin-bottom: 8px;">📦</div>
                                Drag fields from the left to add them here
                            </div>
                        ` : stepFields.map(f => `
                            <div>
                                <label style="display: block; font-size: 0.8rem; color: #aaa; margin-bottom: 4px;">
                                    ${f.label} ${f.required ? '<span style="color: #ff4444;">*</span>' : ''}
                                </label>
                                ${f.type === 'select' ? `
                                    <select disabled style="width: 100%; padding: 10px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; color: #666; font-size: 0.9rem;">
                                        <option>Select...</option>
                                    </select>
                                ` : f.type === 'textarea' ? `
                                    <textarea disabled placeholder="${f.placeholder || ''}" style="width: 100%; padding: 10px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 0.9rem; min-height: 80px; resize: none;"></textarea>
                                ` : f.type === 'checkbox' ? `
                                    <label style="display: flex; align-items: center; gap: 8px; color: #ccc; font-size: 0.9rem;">
                                        <input type="checkbox" disabled style="width: 18px; height: 18px;">
                                        ${f.placeholder || 'I agree'}
                                    </label>
                                ` : `
                                    <input type="${f.type === 'tiktok' ? 'text' : f.type}" disabled placeholder="${f.placeholder || ''}" 
                                           style="width: 100%; padding: 10px 12px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 0.9rem; box-sizing: border-box;">
                                `}
                            </div>
                        `).join('')}
                    </div>
                    
                    <!-- Submit Button -->
                    <button style="width: 100%; margin-top: 20px; padding: 14px; background: ${primaryColor}; color: #000; border: none; border-radius: 10px; font-weight: 600; font-size: 0.95rem; cursor: pointer;">
                        ${activeStepIdx < currentFunnel.steps.length - 1 ? 'Next Step →' : 'Submit Application'}
                    </button>
                </div>
            `;
        }
        
        // Upload video to Supabase Storage
        async function uploadFunnelVideo(type, input) {
            const file = input.files[0];
            if (!file) return;
            
            // Validate file type
            if (!file.type.startsWith('video/')) {
                showToast('Please upload a video file (MP4, WebM)', 'error');
                return;
            }
            
            // Validate file size (500MB max)
            const maxSize = 500 * 1024 * 1024;
            if (file.size > maxSize) {
                showToast('Video must be under 500MB', 'error');
                return;
            }
            
            const previewId = type === 'welcome' ? 'welcomeVideoPreview' : 'thankYouVideoPreview';
            const inputId = type === 'welcome' ? 'funnelWelcomeVideo' : 'funnelThankYouVideo';
            
            // Show uploading state
            document.getElementById(previewId).innerHTML = `
                <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; text-align: center;">
                    <div style="margin-bottom: 8px;">📤 Uploading...</div>
                    <div style="height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
                        <div id="${type}UploadProgress" style="height: 100%; background: var(--accent); width: 0%; transition: width 0.3s;"></div>
                    </div>
                </div>
            `;
            
            try {
                // Generate unique filename
                const ext = file.name.split('.').pop();
                const filename = `${type}_${Date.now()}.${ext}`;
                const path = `funnel-videos/${filename}`;
                
                // Upload to Supabase Storage
                const { data, error } = await supabaseClient.storage
                    .from('public-videos')
                    .upload(path, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (error) throw error;
                
                // Get public URL
                const { data: urlData } = supabaseClient.storage
                    .from('public-videos')
                    .getPublicUrl(path);
                
                const videoUrl = urlData.publicUrl;
                
                // Update input field
                document.getElementById(inputId).value = videoUrl;
                
                // Show preview
                document.getElementById(previewId).innerHTML = `
                    <div style="position: relative; border-radius: 8px; overflow: hidden; background: var(--bg-secondary);">
                        <video src="${videoUrl}" style="width: 100%; max-height: 150px; object-fit: cover;" controls muted></video>
                        <button onclick="removeVideoPreview('${type}')" style="position: absolute; top: 4px; right: 4px; background: var(--danger); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 0.8rem;">✕ Remove</button>
                    </div>
                `;
                
                showToast('Video uploaded!', 'success');
                updateFunnelPreview();
                
            } catch (err) {
                console.error('Upload error:', err);
                document.getElementById(previewId).innerHTML = '';
                
                if (err.message?.includes('storage/bucket-not-found') || err.message?.includes('not found')) {
                    showToast('Storage bucket not set up. Create a "public" bucket in Supabase Storage.', 'error');
                } else {
                    showToast('Upload failed: ' + err.message, 'error');
                }
            }
            
            // Clear file input
            input.value = '';
        }
        
        function removeVideoPreview(type) {
            const previewId = type === 'welcome' ? 'welcomeVideoPreview' : 'thankYouVideoPreview';
            const inputId = type === 'welcome' ? 'funnelWelcomeVideo' : 'funnelThankYouVideo';
            
            document.getElementById(previewId).innerHTML = '';
            document.getElementById(inputId).value = '';
            updateFunnelPreview();
        }
        
        async function saveFunnel() {
            // Gather all data
            const name = document.getElementById('funnelName').value.trim();
            const slug = document.getElementById('funnelSlug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
            
            if (!name) {
                showToast('Please enter a funnel name', 'error');
                return;
            }
            if (!slug) {
                showToast('Please enter a URL slug', 'error');
                return;
            }
            
            const funnelData = {
                name: name,
                slug: slug,
                brand: document.getElementById('funnelBrand').value || null,
                status: document.getElementById('funnelStatus').value || 'draft',
                steps: currentFunnel.steps,
                fields: currentFunnel.fields,
                settings: {
                    primary_color: document.getElementById('funnelPrimaryColor').value,
                    header_title: document.getElementById('funnelHeaderTitle').value,
                    header_subtitle: document.getElementById('funnelHeaderSubtitle').value,
                    logo_url: document.getElementById('funnelLogoUrl').value,
                    welcome_video_url: document.getElementById('funnelWelcomeVideo').value,
                    success_title: document.getElementById('funnelSuccessTitle').value,
                    success_message: document.getElementById('funnelSuccessMessage').value,
                    thank_you_video_url: document.getElementById('funnelThankYouVideo').value,
                    discord_oauth_enabled: document.getElementById('funnelDiscordOAuth').checked,
                    discord_client_id: document.getElementById('funnelDiscordClientId').value,
                    discord_server_link: document.getElementById('funnelDiscordLink').value
                }
            };
            
            try {
                if (currentFunnel.id) {
                    // Update existing
                    const { error } = await supabaseClient
                        .from('application_funnels')
                        .update(funnelData)
                        .eq('id', currentFunnel.id);
                    
                    if (error) throw error;
                    showToast('Funnel updated!', 'success');
                } else {
                    // Create new
                    const { error } = await supabaseClient
                        .from('application_funnels')
                        .insert([funnelData]);
                    
                    if (error) throw error;
                    showToast('Funnel created!', 'success');
                }
                
                closeFunnelBuilder();
                loadFunnelsData();
            } catch (err) {
                console.error('Error saving funnel:', err);
                if (err.message?.includes('duplicate')) {
                    showToast('Slug already exists. Choose a different one.', 'error');
                } else {
                    showToast('Failed to save funnel: ' + err.message, 'error');
                }
            }
        }
        
        function previewFunnelFullPage() {
            const slug = document.getElementById('funnelSlug').value || 'preview';
            window.open(`/apply.html?funnel=${slug}&preview=1`, '_blank');
        }

        // Init - wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
        
        console.log('Script loaded, init scheduled');
