// ==================== USER MANAGEMENT ====================
        // ==================== GENERATE PAYMENTS ====================
        function openGeneratePaymentsModal() {
            // Set default dates to last week
            setPayPeriodLastWeek();
            document.getElementById('paymentPreviewSection').style.display = 'none';
            document.getElementById('generatePaymentsModal').classList.add('show');
        }
        
        function closeGeneratePaymentsModal() {
            document.getElementById('generatePaymentsModal').classList.remove('show');
        }
        
        function setPayPeriodLastWeek() {
            const end = new Date();
            end.setDate(end.getDate() - 1); // Yesterday
            const start = new Date(end);
            start.setDate(start.getDate() - 6); // 7 days total
            
            document.getElementById('payPeriodStart').value = localDateStr(start);
            document.getElementById('payPeriodEnd').value = localDateStr(end);
        }
        
        function setPayPeriodLast2Weeks() {
            const end = new Date();
            end.setDate(end.getDate() - 1);
            const start = new Date(end);
            start.setDate(start.getDate() - 13); // 14 days total
            
            document.getElementById('payPeriodStart').value = localDateStr(start);
            document.getElementById('payPeriodEnd').value = localDateStr(end);
        }
        
        function setPayPeriodLastMonth() {
            const end = new Date();
            end.setDate(end.getDate() - 1);
            const start = new Date(end);
            start.setMonth(start.getMonth() - 1);
            
            document.getElementById('payPeriodStart').value = localDateStr(start);
            document.getElementById('payPeriodEnd').value = localDateStr(end);
        }
        
        function setPayPeriodThisMonth() {
            const end = new Date();
            end.setDate(end.getDate() - 1);
            const start = new Date(end.getFullYear(), end.getMonth(), 1);
            
            document.getElementById('payPeriodStart').value = localDateStr(start);
            document.getElementById('payPeriodEnd').value = localDateStr(end);
        }
        
        async function previewPayments() {
            const startDate = document.getElementById('payPeriodStart').value;
            const endDate = document.getElementById('payPeriodEnd').value;
            const brandSelect = document.getElementById('paymentsBrandSelect').value;
            
            if (!startDate || !endDate) {
                showToast('Please select a date range', 'error');
                return;
            }
            
            try {
                // Get performance data for the period
                let query = supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate);
                
                if (brandSelect !== 'all') {
                    query = query.eq('brand', brandSelect);
                }
                
                const { data: perfData, error: perfError } = await query;
                if (perfError) throw perfError;
                
                // Get roster with commission rates
                const { data: rosterData, error: rosterError } = await supabaseClient
                    .from('managed_creators')
                    .select('account_1, account_2, account_3, account_4, account_5, brand, commission_rate');
                if (rosterError) throw rosterError;
                
                // Build lookup for commission rates
                const commissionLookup = {};
                (rosterData || []).forEach(r => {
                    const rate = parseFloat(r.commission_rate) || 0.10;
                    [r.account_1, r.account_2, r.account_3, r.account_4, r.account_5].forEach(acct => {
                        if (acct) {
                            const key = `${acct.toLowerCase()}|||${r.brand}`;
                            commissionLookup[key] = rate;
                        }
                    });
                });
                
                // Aggregate GMV by creator and brand
                const creatorTotals = {};
                (perfData || []).forEach(row => {
                    const key = `${row.creator_name}|||${row.brand}`;
                    if (!creatorTotals[key]) {
                        creatorTotals[key] = { 
                            creator: row.creator_name, 
                            brand: row.brand, 
                            gmv: 0 
                        };
                    }
                    creatorTotals[key].gmv += parseFloat(row.gmv) || 0;
                });
                
                // Calculate commissions
                const payments = Object.values(creatorTotals)
                    .filter(c => c.gmv > 0)
                    .map(c => {
                        const lookupKey = `${c.creator.toLowerCase()}|||${c.brand}`;
                        const rate = commissionLookup[lookupKey] || 0.10;
                        return {
                            creator: c.creator,
                            brand: c.brand,
                            gmv: c.gmv,
                            rate: rate,
                            amount: c.gmv * rate
                        };
                    })
                    .filter(p => p.amount >= 1) // Only include if $1+
                    .sort((a, b) => b.amount - a.amount);
                
                // Store for confirmation
                window.pendingPayments = payments;
                window.pendingPayPeriod = `${startDate} to ${endDate}`;
                
                // Show preview
                const previewBody = document.getElementById('paymentPreviewBody');
                const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
                
                if (payments.length === 0) {
                    previewBody.innerHTML = `
                        <div style="text-align: center; color: var(--text-muted); padding: 20px;">
                            No payments to generate for this period.<br>
                            <span style="font-size: 0.85rem;">Make sure creators have GMV and are in the Roster.</span>
                        </div>
                    `;
                } else {
                    previewBody.innerHTML = `
                        <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-light);">
                            <strong>${payments.length} creators</strong> • <strong style="color: var(--success);">${fmtMoney(totalAmount)}</strong> total
                        </div>
                        ${payments.slice(0, 10).map(p => `
                            <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.85rem;">
                                <span>${p.creator} <span style="color: var(--text-muted);">• ${BRAND_DISPLAY[p.brand] || p.brand}</span></span>
                                <span style="font-weight: 600;">${fmtMoney(p.amount)}</span>
                            </div>
                        `).join('')}
                        ${payments.length > 10 ? `<div style="text-align: center; color: var(--text-muted); padding-top: 8px; font-size: 0.8rem;">+ ${payments.length - 10} more creators</div>` : ''}
                    `;
                }
                
                document.getElementById('paymentPreviewSection').style.display = 'block';
                
            } catch (err) {
                console.error('Failed to preview payments:', err);
                showToast('Failed to generate preview', 'error');
            }
        }
        
        async function confirmGeneratePayments() {
            const payments = window.pendingPayments || [];
            const payPeriod = window.pendingPayPeriod || '';
            
            if (payments.length === 0) {
                showToast('No payments to generate. Preview first.', 'error');
                return;
            }
            
            try {
                // Create payment records
                const records = payments.map(p => ({
                    creator_handle: p.creator,
                    brand: p.brand,
                    pay_period: payPeriod,
                    gmv: p.gmv,
                    commission_rate: p.rate,
                    amount: p.amount,
                    status: 'pending',
                    created_at: new Date().toISOString()
                }));
                
                const { error } = await supabaseClient
                    .from('payment_status')
                    .insert(records);
                
                if (error) throw error;
                
                showToast(`Generated ${payments.length} payment records!`, 'success');
                logActivity('payment', `Generated ${payments.length} payments for ${payPeriod}`, 'all');
                closeGeneratePaymentsModal();
                loadPaymentsData();
                
            } catch (err) {
                console.error('Failed to generate payments:', err);
                showToast('Failed to generate payments: ' + err.message, 'error');
            }
        }

        // ==================== USER MANAGEMENT ====================
        let allUsers = [];
        
        async function loadUsersData() {
            showLoading('users', 'Loading user data...');
            try {
                const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';
                const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';
                
                let query = supabaseClient.from('user_profiles').select('*').order('created_at', { ascending: false });
                
                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }
                if (roleFilter !== 'all') {
                    query = query.eq('role', roleFilter);
                }
                
                const { data, error } = await query;
                if (error) throw error;
                
                allUsers = data || [];
                renderUsersTable(allUsers);
                updateUserStats(allUsers);
                updatePendingBadge(allUsers);
                
            } catch (err) {
                console.error('Error loading users:', err);
                showToast('Failed to load users', 'error');
            } finally {
                hideLoading('users');
            }
        }
        
        function renderUsersTable(users) {
            const tbody = document.getElementById('usersTableBody');
            if (!tbody) return;
            
            if (!users || users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No users found</td></tr>';
                return;
            }
            
            tbody.innerHTML = users.map(user => {
                const statusColors = {
                    'pending': 'warning',
                    'approved': 'success',
                    'rejected': 'danger'
                };
                const statusIcons = {
                    'pending': '⏳',
                    'approved': '✅',
                    'rejected': '❌'
                };
                const roleConfig = {
                    'admin': { icon: '👑', label: 'Admin', color: '#f5c518', bg: 'rgba(245, 197, 24, 0.15)' },
                    'content_lead': { icon: '🎯', label: 'Content Lead', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
                    'analyst': { icon: '📊', label: 'Analyst', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
                    'payments': { icon: '💰', label: 'Payments', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
                    'automations': { icon: '⚙️', label: 'Automations', color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)' },
                    'va': { icon: '📋', label: 'VA', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
                    'creator': { icon: '🎬', label: 'Creator', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' },
                    'brand': { icon: '🏷️', label: 'Brand', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' }
                };
                
                const status = user.status || 'pending';
                const role = user.role || 'creator';
                const roleInfo = roleConfig[role] || roleConfig.creator;
                const initial = (user.name || user.email || '?')[0].toUpperCase();
                const avatarUrl = user.discord_avatar ? 
                    `https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png` : null;
                
                return `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${avatarUrl ? 
                                    `<img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--accent);">` :
                                    `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-dim); border: 2px solid var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; color: var(--accent); font-size: 0.8rem;">${initial}</div>`
                                }
                                <span style="font-weight: 600;">${user.name || 'Unknown'}</span>
                            </div>
                        </td>
                        <td style="color: var(--text-muted); font-size: 0.85rem;">${user.email || '-'}</td>
                        <td><span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; background: ${roleInfo.bg}; color: ${roleInfo.color};">${roleInfo.icon} ${roleInfo.label}</span></td>
                        <td><span class="badge badge-${statusColors[status] || 'secondary'}">${statusIcons[status] || ''} ${status.toUpperCase()}</span></td>
                        <td>${user.creator_handle ? `<span style="color: var(--accent);">@${user.creator_handle}</span>` : '<span style="color: var(--text-muted);">-</span>'}</td>
                        <td>${user.brand ? `<span class="badge badge-outline">${BRAND_DISPLAY[user.brand] || user.brand}</span>` : '<span style="color: var(--text-muted);">-</span>'}</td>
                        <td style="color: var(--text-muted); font-size: 0.8rem;">${new Date(user.created_at).toLocaleDateString()}</td>
                        <td style="text-align: right;">
                            <div style="display: flex; gap: 6px; justify-content: flex-end;">
                                ${status === 'pending' ? `
                                    <button class="btn btn-small btn-success" onclick="quickApproveUser('${user.id}')" title="Approve">✅</button>
                                    <button class="btn btn-small btn-danger" onclick="quickRejectUser('${user.id}')" title="Reject">❌</button>
                                ` : ''}
                                <button class="btn btn-small" onclick="openEditUserModal('${user.id}')" title="Edit">✏️</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
        
        function updateUserStats(users) {
            const pending = users.filter(u => !u.status || u.status === 'pending').length;
            const approved = users.filter(u => u.status === 'approved').length;
            const creators = users.filter(u => u.role === 'creator').length;
            const teamRoles = ['admin', 'content_lead', 'analyst', 'payments', 'automations', 'va'];
            const team = users.filter(u => teamRoles.includes(u.role)).length;
            
            document.getElementById('statPendingUsers').textContent = pending;
            document.getElementById('statApprovedUsers').textContent = approved;
            document.getElementById('statCreatorUsers').textContent = creators;
            document.getElementById('statTotalUsers').textContent = team;
            
            // Store for later use
            window.userStats = { pending, approved, creators, team, total: users.length };
        }
        
        function filterUsersByStatus(status) {
            document.getElementById('userStatusFilter').value = status;
            document.getElementById('userRoleFilter').value = 'all';
            loadUsersData();
        }
        
        function filterUsersByRole(role) {
            document.getElementById('userRoleFilter').value = role;
            document.getElementById('userStatusFilter').value = 'all';
            loadUsersData();
        }
        
        async function quickApproveUser(userId) {
            try {
                const { error } = await supabaseClient
                    .from('user_profiles')
                    .update({ status: 'approved' })
                    .eq('id', userId);
                
                if (error) throw error;
                showToast('User approved!', 'success');
                loadUsersData();
            } catch (err) {
                console.error('Error approving user:', err);
                showToast('Failed to approve user', 'error');
            }
        }
        
        async function quickRejectUser(userId) {
            if (!confirm('Are you sure you want to reject this user?')) return;
            
            try {
                const { error } = await supabaseClient
                    .from('user_profiles')
                    .update({ status: 'rejected' })
                    .eq('id', userId);
                
                if (error) throw error;
                showToast('User rejected', 'success');
                loadUsersData();
            } catch (err) {
                console.error('Error rejecting user:', err);
                showToast('Failed to reject user', 'error');
            }
        }
        
        function updatePendingBadge(users) {
            const pending = users.filter(u => !u.status || u.status === 'pending').length;
            const badge = document.getElementById('pendingUsersBadge');
            if (badge) {
                badge.textContent = pending;
                badge.style.display = pending > 0 ? 'inline-block' : 'none';
            }
        }
        
        // Lightweight function to update pending users badge on init
        async function updatePendingUsersBadge() {
            try {
                // Get pending counts from all user types
                const [internalRes, brandsRes] = await Promise.all([
                    supabaseClient.from('user_profiles').select('id, status').eq('status', 'pending'),
                    supabaseClient.from('brand_portal_users').select('id, status').eq('status', 'pending')
                ]);
                
                const pendingInternal = (internalRes.data || []).length;
                const pendingBrands = (brandsRes.data || []).length;
                const pendingTotal = pendingInternal + pendingBrands;
                
                const badge = document.getElementById('pendingUsersBadge');
                if (badge) {
                    badge.textContent = pendingTotal;
                    badge.style.display = pendingTotal > 0 ? 'inline-block' : 'none';
                }
                
                console.log(`Pending users badge: ${pendingTotal} (internal: ${pendingInternal}, brands: ${pendingBrands})`);
            } catch (err) {
                console.warn('Could not update pending users badge:', err);
            }
        }
        
        async function quickApproveUser(userId) {
            try {
                const { error } = await supabaseClient
                    .from('user_profiles')
                    .update({ status: 'approved', updated_at: new Date().toISOString() })
                    .eq('id', userId);
                    
                if (error) throw error;
                
                showToast('User approved!', 'success');
                logActivity('edit', 'Quick approved user', null, { user_id: userId });
                loadUsersData();
            } catch (err) {
                console.error('Error approving user:', err);
                showToast('Failed to approve user', 'error');
            }
        }
        
        async function quickRejectUser(userId) {
            if (!confirm('Are you sure you want to reject this user?')) return;
            
            try {
                const { error } = await supabaseClient
                    .from('user_profiles')
                    .update({ status: 'rejected', updated_at: new Date().toISOString() })
                    .eq('id', userId);
                    
                if (error) throw error;
                
                showToast('User rejected', 'warning');
                logActivity('edit', 'Rejected user', null, { user_id: userId });
                loadUsersData();
            } catch (err) {
                console.error('Error rejecting user:', err);
                showToast('Failed to reject user', 'error');
            }
        }
        
        function openEditUserModal(userId) {
            const user = allUsers.find(u => u.id === userId);
            if (!user) return;
            
            document.getElementById('editUserId').value = user.id;
            document.getElementById('editUserName').textContent = user.name || 'Unknown';
            document.getElementById('editUserEmail').textContent = user.email || '';
            document.getElementById('editUserStatus').value = user.status || 'pending';
            document.getElementById('editUserRole').value = user.role || 'creator';
            document.getElementById('editCreatorHandle').value = user.creator_handle || '';
            document.getElementById('editUserBrand').value = user.brand || '';
            
            // Set avatar
            const avatarEl = document.getElementById('editUserAvatar');
            if (user.discord_avatar && user.discord_id) {
                avatarEl.innerHTML = `<img src="https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png" style="width: 100%; height: 100%; border-radius: 50%;">`;
            } else {
                avatarEl.textContent = (user.name || user.email || '?')[0].toUpperCase();
            }
            
            toggleUserRoleFields();
            document.getElementById('editUserModal').classList.add('show');
        }
        
        function closeEditUserModal() {
            document.getElementById('editUserModal').classList.remove('show');
        }
        
        function toggleUserRoleFields() {
            const role = document.getElementById('editUserRole').value;
            document.getElementById('creatorFields').style.display = role === 'creator' ? 'block' : 'none';
            document.getElementById('brandFields').style.display = role === 'brand' ? 'block' : 'none';
        }
        
        async function saveUserChanges() {
            const userId = document.getElementById('editUserId').value;
            const status = document.getElementById('editUserStatus').value;
            const role = document.getElementById('editUserRole').value;
            const creatorHandle = document.getElementById('editCreatorHandle').value.replace('@', '').trim();
            const brand = document.getElementById('editUserBrand').value;
            
            try {
                const updateData = {
                    status,
                    role,
                    creator_handle: role === 'creator' ? creatorHandle : null,
                    brand: role === 'brand' ? brand : null,
                    updated_at: new Date().toISOString()
                };
                
                const { error } = await supabaseClient
                    .from('user_profiles')
                    .update(updateData)
                    .eq('id', userId);
                    
                if (error) throw error;
                
                showToast('User updated successfully!', 'success');
                logActivity('edit', `Updated user: ${document.getElementById('editUserName').textContent}`, null, updateData);
                closeEditUserModal();
                loadUsersData();
            } catch (err) {
                console.error('Error saving user:', err);
                showToast('Failed to save changes', 'error');
            }
        }
        
        async function rejectUser() {
            const userId = document.getElementById('editUserId').value;
            if (!confirm('Are you sure you want to reject this user?')) return;
            
            try {
                const { error } = await supabaseClient
                    .from('user_profiles')
                    .update({ status: 'rejected', updated_at: new Date().toISOString() })
                    .eq('id', userId);
                    
                if (error) throw error;
                
                showToast('User rejected', 'warning');
                logActivity('edit', `Rejected user: ${document.getElementById('editUserName').textContent}`);
                closeEditUserModal();
                loadUsersData();
            } catch (err) {
                console.error('Error rejecting user:', err);
                showToast('Failed to reject user', 'error');
            }
        }

        // ==================== CONSOLIDATED USER MANAGEMENT ====================
        let currentUsersTab = 'internal';
        let currentCreatorsSubTab = 'roster';
        let internalTeamData = [];
        let creatorsData = [];
        let brandsData = [];
        let accountRequestsData = [];
        let applicationsData = [];

        // Tab switching
        function switchUsersTab(tab) {
            currentUsersTab = tab;
            
            // Update tab button styling (using IDs to avoid conflict with Ops Center tabs)
            ['internal', 'creators', 'brands'].forEach(t => {
                const btn = document.getElementById(`usersTab-${t}-btn`);
                if (btn) {
                    if (t === tab) {
                        btn.classList.add('active');
                        btn.style.background = 'var(--bg-card)';
                        btn.style.color = 'var(--text-primary)';
                        btn.style.fontWeight = '600';
                        btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    } else {
                        btn.classList.remove('active');
                        btn.style.background = 'transparent';
                        btn.style.color = 'var(--text-muted)';
                        btn.style.fontWeight = '500';
                        btn.style.boxShadow = 'none';
                    }
                }
            });
            
            // Update tab content
            document.querySelectorAll('.users-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(`usersTab-${tab}`).style.display = 'block';
            
            // Load data for the tab
            if (tab === 'internal') loadInternalTeam();
            else if (tab === 'creators') {
                // Load the roster by default, and trigger the current sub-tab
                switchCreatorsSubTab(currentCreatorsSubTab || 'roster');
            }
            else if (tab === 'brands') loadBrandsTab();
        }

        function switchCreatorsSubTab(subTab) {
            currentCreatorsSubTab = subTab;
            
            // Update sub-tab button styling
            ['roster', 'claims', 'requests', 'applications'].forEach(t => {
                const btn = document.getElementById(`creatorsSubTab-${t}`);
                if (btn) {
                    if (t === subTab) {
                        btn.style.background = 'var(--bg-card)';
                        btn.style.color = 'var(--text-primary)';
                        btn.style.fontWeight = '600';
                        btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                    } else {
                        btn.style.background = 'transparent';
                        btn.style.color = 'var(--text-muted)';
                        btn.style.fontWeight = '500';
                        btn.style.boxShadow = 'none';
                    }
                }
            });
            
            // Update sub-tab content
            document.querySelectorAll('[id^="creatorsSubContent-"]').forEach(content => {
                content.style.display = 'none';
            });
            document.getElementById(`creatorsSubContent-${subTab}`).style.display = 'block';
            
            // Load data
            if (subTab === 'roster') loadCreatorsRoster();
            else if (subTab === 'claims') loadClaimRequests();
            else if (subTab === 'requests') loadAccountRequests();
            else if (subTab === 'applications') loadApplicationsSubTab();
        }

        function refreshUsersTab() {
            if (currentUsersTab === 'internal') loadInternalTeam();
            else if (currentUsersTab === 'creators') loadRosterTab();
            else if (currentUsersTab === 'brands') loadBrandsTab();
            showToast('Refreshed!', 'success');
        }

        // Load all counts for stats
        async function loadUsersData() {
            showLoading('users', 'Loading user data...');
            try {
                // Load counts in parallel
                const [internalRes, creatorsRes, brandsRes] = await Promise.all([
                    supabaseClient.from('user_profiles').select('id, status, role').in('role', ['admin', 'content_lead', 'analyst', 'payments', 'automations', 'va']),
                    supabaseClient.from('managed_creators').select('id'),
                    supabaseClient.from('brand_portal_users').select('id, status')
                ]);

                // Calculate counts
                const internalData = internalRes.data || [];
                const creatorsDataAll = creatorsRes.data || [];
                const brandsDataAll = brandsRes.data || [];

                const internalCount = internalData.length;
                const creatorsCount = creatorsDataAll.length;
                const brandsCount = brandsDataAll.length;

                const pendingInternal = internalData.filter(u => u.status === 'pending').length;
                const pendingCreators = 0; // managed_creators doesn't have status column
                const pendingBrands = brandsDataAll.filter(b => b.status === 'pending').length;
                const pendingTotal = pendingInternal + pendingCreators + pendingBrands;

                // Update stats
                document.getElementById('statInternalCount').textContent = internalCount;
                document.getElementById('statCreatorsCount').textContent = creatorsCount;
                document.getElementById('statBrandsCount').textContent = brandsCount;
                document.getElementById('statPendingTotal').textContent = pendingTotal;

                // Update badges
                updateTabBadge('internalPendingBadge', pendingInternal);
                updateTabBadge('creatorsPendingBadge', pendingCreators);
                updateTabBadge('brandsPendingBadge', pendingBrands);
                updateTabBadge('pendingUsersBadge', pendingTotal);

                // Load current tab data
                if (currentUsersTab === 'internal') await loadInternalTeam();
                else if (currentUsersTab === 'creators') await loadRosterTab();
                else if (currentUsersTab === 'brands') await loadBrandsTab();

            } catch (err) {
                console.error('Error loading users data:', err);
                showToast('Failed to load users', 'error');
            } finally {
                hideLoading('users');
            }
        }

        function updateTabBadge(id, count) {
            const badge = document.getElementById(id);
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-block' : 'none';
            }
        }

        // ==================== INTERNAL TEAM TAB ====================
        let pendingAccessRequests = [];
        
        async function loadInternalTeam() {
            const tbody = document.getElementById('internalTeamBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading...</td></tr>';

            try {
                // Load pending access requests first
                await loadPendingAccessRequests();
                
                const statusFilter = document.getElementById('internalStatusFilter')?.value || 'all';
                const roleFilter = document.getElementById('internalRoleFilter')?.value || 'all';

                let query = supabaseClient.from('user_profiles')
                    .select('*')
                    .in('role', ['admin', 'content_lead', 'analyst', 'payments', 'automations', 'va'])
                    .order('created_at', { ascending: false });

                if (statusFilter !== 'all') query = query.eq('status', statusFilter);
                if (roleFilter !== 'all') query = query.eq('role', roleFilter);

                const { data, error } = await query;
                if (error) throw error;

                internalTeamData = data || [];
                renderInternalTeamTable(internalTeamData);

            } catch (err) {
                console.error('Error loading internal team:', err);
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--danger);">Failed to load team data</td></tr>';
            }
        }

        async function loadPendingAccessRequests() {
            try {
                const { data, error } = await supabaseClient
                    .from('admin_access_requests')
                    .select('*')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });

                if (error) {
                    console.log('Access requests table may not exist yet:', error.message);
                    pendingAccessRequests = [];
                } else {
                    pendingAccessRequests = data || [];
                }

                renderPendingAccessRequests();
                
                // Update badge
                const badge = document.getElementById('internalPendingBadge');
                if (badge) {
                    const totalPending = pendingAccessRequests.length + (internalTeamData?.filter(u => u.status === 'pending').length || 0);
                    badge.textContent = totalPending;
                    badge.style.display = totalPending > 0 ? 'inline-block' : 'none';
                }
            } catch (err) {
                console.error('Error loading access requests:', err);
                pendingAccessRequests = [];
            }
        }

        function renderPendingAccessRequests() {
            const section = document.getElementById('pendingAccessRequestsSection');
            const tbody = document.getElementById('pendingAccessRequestsBody');
            const countBadge = document.getElementById('pendingRequestsCount');
            
            if (!section || !tbody) return;

            if (pendingAccessRequests.length === 0) {
                section.style.display = 'none';
                return;
            }

            section.style.display = 'block';
            countBadge.textContent = pendingAccessRequests.length;

            const roleConfig = {
                'admin': { icon: '👑', label: 'Admin', color: '#f5c518' },
                'content_lead': { icon: '🎯', label: 'Content Lead', color: '#ec4899' },
                'analyst': { icon: '📊', label: 'Analyst', color: '#8b5cf6' },
                'payments': { icon: '💰', label: 'Payments', color: '#22c55e' },
                'automations': { icon: '⚙️', label: 'Automations', color: '#6b7280' },
                'va': { icon: '📋', label: 'VA', color: '#06b6d4' }
            };

            tbody.innerHTML = pendingAccessRequests.map(req => {
                const roleInfo = roleConfig[req.requested_role] || { icon: '👤', label: req.requested_role, color: '#888' };
                const submitted = new Date(req.created_at).toLocaleDateString();
                
                let avatarHtml = '';
                if (req.discord_avatar) {
                    avatarHtml = `<img src="${req.discord_avatar}" style="width: 100%; height: 100%; border-radius: 50%;" onerror="this.outerHTML='${(req.name || '?')[0].toUpperCase()}'">`;
                } else {
                    const name = encodeURIComponent(req.name || req.email?.split('@')[0] || 'U');
                    avatarHtml = `<img src="https://ui-avatars.com/api/?name=${name}&background=f59e0b&color=fff&size=36" style="width: 100%; height: 100%; border-radius: 50%;">`;
                }

                return `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; font-weight: 600; overflow: hidden;">
                                    ${avatarHtml}
                                </div>
                                <div>
                                    <div style="font-weight: 600;">${req.name || 'Unknown'}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">${req.discord_username || ''}</div>
                                </div>
                            </div>
                        </td>
                        <td style="color: var(--text-secondary);">${req.email || '-'}</td>
                        <td>
                            <select id="approveRole_${req.id}" style="padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-size: 0.85rem;">
                                ${Object.entries(roleConfig).map(([value, info]) => 
                                    `<option value="${value}" ${req.requested_role === value ? 'selected' : ''}>${info.icon} ${info.label}</option>`
                                ).join('')}
                            </select>
                        </td>
                        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted);" title="${req.reason || ''}">${req.reason || '-'}</td>
                        <td style="color: var(--text-muted);">${submitted}</td>
                        <td style="text-align: right;">
                            <div style="display: flex; gap: 8px; justify-content: flex-end;">
                                <button onclick="approveAccessRequest('${req.id}', '${req.user_id}', '${req.email}', '${req.name}')" class="btn btn-sm" style="background: var(--success); color: #fff;">✓ Approve</button>
                                <button onclick="denyAccessRequest('${req.id}', '${req.name}')" class="btn btn-sm" style="background: var(--danger); color: #fff;">✗ Deny</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        async function approveAccessRequest(requestId, userId, email, name) {
            const roleSelect = document.getElementById(`approveRole_${requestId}`);
            const role = roleSelect?.value || 'va';

            try {
                // Create user_profiles entry
                const { error: profileError } = await supabaseClient
                    .from('user_profiles')
                    .upsert({
                        user_id: userId,
                        email: email,
                        name: name,
                        role: role,
                        status: 'approved',
                        created_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });

                if (profileError) throw profileError;

                // Update request status
                const { error: requestError } = await supabaseClient
                    .from('admin_access_requests')
                    .update({ 
                        status: 'approved',
                        approved_role: role,
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: window.currentUser?.name || 'admin'
                    })
                    .eq('id', requestId);

                if (requestError) throw requestError;

                showToast(`${name} approved as ${role}!`, 'success');
                loadInternalTeam();
            } catch (err) {
                console.error('Error approving request:', err);
                showToast('Failed to approve request', 'error');
            }
        }

        async function denyAccessRequest(requestId, name) {
            const reason = prompt(`Reason for denying ${name}'s request (optional):`);
            
            try {
                const { error } = await supabaseClient
                    .from('admin_access_requests')
                    .update({ 
                        status: 'denied',
                        denied_reason: reason || 'Request not approved',
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: window.currentUser?.name || 'admin'
                    })
                    .eq('id', requestId);

                if (error) throw error;

                showToast(`${name}'s request denied`, 'info');
                loadInternalTeam();
            } catch (err) {
                console.error('Error denying request:', err);
                showToast('Failed to deny request', 'error');
            }
        }

        function renderInternalTeamTable(users) {
            const tbody = document.getElementById('internalTeamBody');
            if (!users || users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">No team members found</td></tr>';
                return;
            }

            const roleConfig = {
                'admin': { icon: '👑', label: 'Admin', color: '#f5c518' },
                'content_lead': { icon: '🎯', label: 'Content Lead', color: '#ec4899' },
                'analyst': { icon: '📊', label: 'Analyst', color: '#8b5cf6' },
                'payments': { icon: '💰', label: 'Payments', color: '#22c55e' },
                'automations': { icon: '⚙️', label: 'Automations', color: '#6b7280' },
                'va': { icon: '📋', label: 'VA', color: '#06b6d4' }
            };

            tbody.innerHTML = users.map(user => {
                const roleInfo = roleConfig[user.role] || { icon: '👤', label: user.role, color: '#888' };
                const status = user.status || 'pending';
                const statusIcon = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⏳';
                const statusColor = status === 'approved' ? 'var(--success)' : status === 'rejected' ? 'var(--danger)' : 'var(--warning)';
                const joined = user.created_at ? new Date(user.created_at).toLocaleDateString() : '-';
                
                // Generate avatar - try Discord first, then Gravatar, then initials
                let avatarHtml = '';
                if (user.discord_avatar && user.discord_id) {
                    avatarHtml = `<img src="https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png" style="width: 100%; height: 100%; border-radius: 50%;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                  <span style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center;">${(user.name || user.email || '?')[0].toUpperCase()}</span>`;
                } else if (user.email) {
                    // Use UI Avatars as fallback (generates nice letter avatars)
                    const name = encodeURIComponent(user.name || user.email.split('@')[0]);
                    avatarHtml = `<img src="https://ui-avatars.com/api/?name=${name}&background=${roleInfo.color.replace('#', '')}&color=fff&size=36" style="width: 100%; height: 100%; border-radius: 50%;">`;
                } else {
                    avatarHtml = (user.name || user.email || '?')[0].toUpperCase();
                }

                // Role dropdown options
                const roleOptions = Object.entries(roleConfig).map(([value, info]) => 
                    `<option value="${value}" ${user.role === value ? 'selected' : ''}>${info.icon} ${info.label}</option>`
                ).join('');

                return `
                    <tr data-user-id="${user.id}">
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, ${roleInfo.color}33, ${roleInfo.color}66); display: flex; align-items: center; justify-content: center; font-size: 1rem; overflow: hidden;">
                                    ${avatarHtml}
                                </div>
                                <div>
                                    <div style="font-weight: 600;">${user.name || 'Unknown'}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">${user.discord_id ? `Discord: ${user.discord_id}` : ''}</div>
                                </div>
                            </div>
                        </td>
                        <td style="font-size: 0.85rem;">${user.email || '-'}</td>
                        <td>
                            ${status === 'approved' ? `
                                <select onchange="updateInternalUserRole('${user.id}', this.value)" style="padding: 6px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-secondary); color: var(--text-primary); font-size: 0.8rem; cursor: pointer;">
                                    ${roleOptions}
                                </select>
                            ` : `
                                <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; background: ${roleInfo.color}22; color: ${roleInfo.color}; font-size: 0.8rem; font-weight: 600;">${roleInfo.icon} ${roleInfo.label}</span>
                            `}
                        </td>
                        <td><span style="color: ${statusColor};">${statusIcon} ${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                        <td style="font-size: 0.85rem;">${joined}</td>
                        <td style="text-align: right;">
                            ${status === 'pending' ? `
                                <button class="btn btn-sm btn-success" onclick="approveInternalUser('${user.id}')" style="margin-right: 4px;" title="Approve">✅</button>
                                <button class="btn btn-sm btn-danger" onclick="rejectInternalUser('${user.id}')" title="Reject">❌</button>
                            ` : `
                                <button class="btn btn-sm btn-danger" onclick="removeInternalUser('${user.id}', '${(user.name || user.email || '').replace(/'/g, "\\'")}')" title="Remove from team">🗑️</button>
                            `}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        async function updateInternalUserRole(userId, newRole) {
            try {
                const { error } = await supabaseClient.from('user_profiles')
                    .update({ role: newRole })
                    .eq('id', userId);
                if (error) throw error;
                showToast(`Role updated to ${newRole}`, 'success');
                // Update local data without full reload
                const user = internalTeamData.find(u => u.id === userId);
                if (user) user.role = newRole;
            } catch (err) {
                console.error(err);
                showToast('Failed to update role', 'error');
                loadInternalTeam(); // Reload on error to reset dropdown
            }
        }

        async function removeInternalUser(userId, userName) {
            if (!confirm(`Remove ${userName} from the team?\n\nThis will delete their profile. They can re-register later if needed.`)) return;
            
            try {
                const { error } = await supabaseClient.from('user_profiles')
                    .delete()
                    .eq('id', userId);
                if (error) throw error;
                showToast(`${userName} removed from team`, 'success');
                loadInternalTeam();
                loadUsersData();
            } catch (err) {
                console.error(err);
                showToast('Failed to remove user', 'error');
            }
        }

        async function approveInternalUser(userId) {
            const role = prompt('Assign role (admin, content_lead, analyst, payments, automations, va):');
            if (!role || !['admin', 'content_lead', 'analyst', 'payments', 'automations', 'va'].includes(role)) {
                showToast('Invalid role', 'error');
                return;
            }

            try {
                const { error } = await supabaseClient.from('user_profiles')
                    .update({ status: 'approved', role: role })
                    .eq('id', userId);
                if (error) throw error;
                showToast('User approved!', 'success');
                loadInternalTeam();
                loadUsersData();
            } catch (err) {
                console.error(err);
                showToast('Failed to approve user', 'error');
            }
        }

        async function rejectInternalUser(userId) {
            if (!confirm('Reject this user?')) return;
            try {
                const { error } = await supabaseClient.from('user_profiles')
                    .update({ status: 'rejected' })
                    .eq('id', userId);
                if (error) throw error;
                showToast('User rejected', 'warning');
                loadInternalTeam();
                loadUsersData();
            } catch (err) {
                console.error(err);
                showToast('Failed to reject user', 'error');
            }
        }

        function showInviteTeamModal() {
            document.getElementById('adminPortalLink').textContent = window.location.origin + '/admin.html';
            document.getElementById('inviteTeamModal').style.display = 'flex';
        }

        function hideInviteTeamModal() {
            document.getElementById('inviteTeamModal').style.display = 'none';
        }

        function copyAdminPortalLink() {
            navigator.clipboard.writeText(window.location.origin + '/admin.html');
            showToast('Link copied!', 'success');
        }

        // ==================== CREATORS TAB ====================
        async function loadRosterTab() {
            await loadCreatorsRoster();
            await loadClaimRequestsCount();
            await loadAccountRequestsCount();
            await loadApplicationsCount();
        }

        async function loadCreatorsRoster() {
            const tbody = document.getElementById('creatorsRosterBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading...</td></tr>';

            try {
                const statusFilter = document.getElementById('rosterStatusFilter')?.value || 'all';
                const brandFilter = document.getElementById('rosterBrandFilter')?.value || 'all';

                let query = supabaseClient.from('managed_creators')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (statusFilter !== 'all') query = query.eq('status', statusFilter);
                if (brandFilter !== 'all') query = query.eq('brand', brandFilter);

                const { data, error } = await query;
                if (error) throw error;

                creatorsData = data || [];
                document.getElementById('rosterCountLabel').textContent = `${creatorsData.length} creators`;
                renderCreatorsRosterTable(creatorsData);

            } catch (err) {
                console.error('Error loading creators:', err);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">Failed to load creators</td></tr>';
            }
        }

        function renderCreatorsRosterTable(creators) {
            const tbody = document.getElementById('creatorsRosterBody');
            if (!creators || creators.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No creators found</td></tr>';
                return;
            }

            tbody.innerHTML = creators.map(c => {
                const status = c.status || 'Active';
                const statusIcon = status === 'Active' ? '✅' : status === 'Inactive' ? '❌' : '⏸️';
                const statusColor = status === 'Active' ? 'var(--success)' : status === 'Inactive' ? 'var(--danger)' : 'var(--warning)';
                const hasDiscord = c.discord_id || c.discord_user_id;
                const joined = c.created_at ? new Date(c.created_at).toLocaleDateString() : '-';
                const brandDisplay = BRAND_DISPLAY[c.brand] || c.brand || '-';

                return `
                    <tr>
                        <td>
                            <div style="font-weight: 600;">${c.real_name || c.account_1 || 'Unknown'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${c.email || ''}</div>
                        </td>
                        <td><code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">@${c.account_1 || '-'}</code></td>
                        <td>${brandDisplay}</td>
                        <td><span style="color: ${statusColor};">${statusIcon} ${status}</span></td>
                        <td>${hasDiscord ? `<span style="color: var(--success);">✅ Linked</span>` : '<span style="color: var(--text-muted);">❌ No</span>'}</td>
                        <td>${joined}</td>
                        <td style="text-align: right;">
                            <button class="btn btn-sm" onclick="viewCreatorDetails('${c.id}')" style="margin-right: 4px;">👁️</button>
                            ${hasDiscord ? `<button class="btn btn-sm" onclick="unlinkCreatorDiscord('${c.id}')" title="Unlink Discord">🔗❌</button>` : ''}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        function filterRosterTable() {
            const search = document.getElementById('rosterSearch')?.value?.toLowerCase() || '';
            const filtered = creatorsData.filter(c => {
                const name = (c.real_name || '').toLowerCase();
                const handle = (c.account_1 || '').toLowerCase();
                return name.includes(search) || handle.includes(search);
            });
            renderCreatorsRosterTable(filtered);
        }

        function viewCreatorDetails(id) {
            const creator = creatorsData.find(c => c.id == id);
            if (creator) {
                let details = `CREATOR DETAILS\n${'='.repeat(40)}\n\n`;
                details += `Name: ${creator.real_name || 'Unknown'}\n`;
                details += `Primary Handle: @${creator.account_1 || '-'}\n`;
                if (creator.account_2) details += `Account 2: @${creator.account_2}\n`;
                if (creator.account_3) details += `Account 3: @${creator.account_3}\n`;
                if (creator.account_4) details += `Account 4: @${creator.account_4}\n`;
                if (creator.account_5) details += `Account 5: @${creator.account_5}\n`;
                details += `\nEmail: ${creator.email || '-'}\n`;
                details += `Brand: ${BRAND_DISPLAY[creator.brand] || creator.brand || '-'}\n`;
                details += `Status: ${creator.status || 'Active'}\n`;
                details += `Discord ID: ${creator.discord_id || 'Not linked'}\n`;
                details += `Created: ${creator.created_at ? new Date(creator.created_at).toLocaleString() : '-'}`;
                
                alert(details);
            }
        }

        async function unlinkCreatorDiscord(id) {
            const creator = creatorsData.find(c => c.id == id);
            if (!creator) return;

            if (!confirm(`Unlink Discord from ${creator.real_name || creator.account_1}?\n\nThey will need to re-claim their account to access the Creator Portal again.`)) {
                return;
            }

            try {
                const { error } = await supabaseClient.from('managed_creators')
                    .update({ 
                        discord_id: null, 
                        discord_user_id: null,
                        discord_avatar: null 
                    })
                    .eq('id', id);

                if (error) throw error;

                showToast(`Unlinked Discord from ${creator.real_name || creator.account_1}`, 'success');
                logActivity('edit', `Unlinked Discord from creator ${creator.real_name || creator.account_1}`);
                loadCreatorsRoster();

            } catch (err) {
                console.error('Error unlinking Discord:', err);
                showToast('Failed to unlink Discord', 'error');
            }
        }

        // ==================== CLAIM REQUESTS ====================
        let claimRequestsData = [];

        async function loadClaimRequestsCount() {
            try {
                const { data } = await supabaseClient.from('creator_claim_requests')
                    .select('id')
                    .eq('status', 'pending');
                updateTabBadge('claimRequestsBadge', data?.length || 0);
            } catch (err) {
                console.warn('Could not load claim requests count');
            }
        }

        async function loadClaimRequests() {
            const tbody = document.getElementById('claimRequestsBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading...</td></tr>';

            try {
                const { data, error } = await supabaseClient.from('creator_claim_requests')
                    .select('*')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });
                
                if (error) throw error;

                claimRequestsData = data || [];
                updateTabBadge('claimRequestsBadge', claimRequestsData.length);

                if (claimRequestsData.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No pending claim requests 🎉</td></tr>';
                    return;
                }

                tbody.innerHTML = claimRequestsData.map(req => {
                    const records = req.found_records || [];
                    const totalBrands = records.length;
                    const totalAccounts = records.reduce((sum, r) => sum + (r.accounts?.length || 0), 0);
                    const totalGmv = records.reduce((sum, r) => sum + (r.gmv || 0), 0);
                    const timeAgo = formatTimeAgoAdmin(new Date(req.created_at));

                    return `
                        <tr>
                            <td>
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--purple-dim); display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                        ${req.discord_avatar ? `<img src="${req.discord_avatar}" style="width: 100%; height: 100%; object-fit: cover;">` : `<span style="font-weight: 700;">${(req.discord_username || '?')[0].toUpperCase()}</span>`}
                                    </div>
                                    <div>
                                        <div style="font-weight: 600;">${req.discord_username || 'Unknown'}</div>
                                        <div style="font-size: 0.8rem; color: var(--purple);">Discord: ${req.discord_username || '-'}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-muted);">${req.discord_email || ''}</div>
                                    </div>
                                </div>
                            </td>
                            <td>
                                <div style="font-weight: 600;">${totalBrands} brand${totalBrands !== 1 ? 's' : ''}</div>
                                <div style="font-size: 0.8rem; color: var(--text-muted);">${totalAccounts} account${totalAccounts !== 1 ? 's' : ''}</div>
                                ${req.searched_handle ? `<div style="font-size: 0.75rem; color: var(--accent);">Searched: @${req.searched_handle}</div>` : ''}
                                <button class="btn btn-sm" style="margin-top: 6px; font-size: 0.75rem;" onclick="viewClaimDetails('${req.id}')">View Details</button>
                            </td>
                            <td>
                                <span style="color: ${totalGmv > 0 ? 'var(--success)' : 'var(--text-muted)'}; font-weight: 600;">
                                    ${totalGmv > 0 ? '$' + totalGmv.toLocaleString() : '$0'}
                                </span>
                            </td>
                            <td style="color: var(--text-muted);">${timeAgo}</td>
                            <td style="text-align: right;">
                                <button class="btn btn-sm btn-success" onclick="approveClaimRequest('${req.id}')" style="margin-right: 4px;">✅ Approve</button>
                                <button class="btn btn-sm btn-danger" onclick="denyClaimRequest('${req.id}')">❌ Deny</button>
                            </td>
                        </tr>
                    `;
                }).join('');

            } catch (err) {
                console.error('Error loading claim requests:', err);
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--danger);">Failed to load claim requests</td></tr>';
            }
        }

        function viewClaimDetails(requestId) {
            const req = claimRequestsData.find(r => r.id === requestId);
            if (!req) return;

            const records = req.found_records || [];
            let details = `CLAIM REQUEST DETAILS\n${'='.repeat(40)}\n\n`;
            details += `Discord: ${req.discord_username}\n`;
            details += `Email: ${req.discord_email || '-'}\n`;
            details += `Searched Handle: @${req.searched_handle}\n\n`;
            details += `FOUND RECORDS:\n${'-'.repeat(40)}\n`;

            records.forEach((r, i) => {
                details += `\n${i + 1}. ${r.brand}\n`;
                details += `   Accounts: ${r.accounts?.map(a => '@' + a).join(', ') || '-'}\n`;
                details += `   GMV: $${(r.gmv || 0).toLocaleString()}\n`;
            });

            alert(details);
        }

        async function approveClaimRequest(requestId) {
            const req = claimRequestsData.find(r => r.id === requestId);
            if (!req) return;

            const records = req.found_records || [];
            const totalBrands = records.length;
            const totalAccounts = records.reduce((sum, r) => sum + (r.accounts?.length || 0), 0);

            if (!confirm(`Approve this claim?\n\nThis will link ${req.discord_username}'s Discord to ${totalBrands} brand(s) with ${totalAccounts} account(s).`)) {
                return;
            }

            try {
                // Update all managed_creators records with Discord ID
                const creatorIds = (req.managed_creator_ids || []).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
                if (creatorIds.length > 0) {
                    const { error: updateError } = await supabaseClient
                        .from('managed_creators')
                        .update({ 
                            discord_id: req.discord_id,
                            discord_user_id: req.discord_id
                        })
                        .in('id', creatorIds);

                    if (updateError) throw updateError;
                }

                // Mark claim request as approved
                const { error: claimError } = await supabaseClient
                    .from('creator_claim_requests')
                    .update({ 
                        status: 'approved',
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: window.currentUser?.username || 'admin'
                    })
                    .eq('id', requestId);

                if (claimError) throw claimError;

                showToast(`Approved! ${req.discord_username} can now access the portal.`, 'success');
                logActivity('edit', `Approved claim request for ${req.discord_username} - linked ${totalBrands} brands`);
                loadClaimRequests();
                loadUsersData();

            } catch (err) {
                console.error('Error approving claim:', err);
                showToast('Failed to approve claim request', 'error');
            }
        }

        async function denyClaimRequest(requestId) {
            const req = claimRequestsData.find(r => r.id === requestId);
            if (!req) return;

            const reason = prompt('Reason for denial (optional):');
            
            try {
                const { error } = await supabaseClient
                    .from('creator_claim_requests')
                    .update({ 
                        status: 'denied',
                        denied_reason: reason || null,
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: window.currentUser?.username || 'admin'
                    })
                    .eq('id', requestId);

                if (error) throw error;

                showToast('Claim request denied', 'warning');
                logActivity('edit', `Denied claim request for ${req.discord_username}`);
                loadClaimRequests();

            } catch (err) {
                console.error('Error denying claim:', err);
                showToast('Failed to deny claim request', 'error');
            }
        }

        function formatTimeAgoAdmin(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            if (seconds < 60) return 'just now';
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return `${minutes}m ago`;
            const hours = Math.floor(minutes / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            return `${days}d ago`;
        }

        async function loadAccountRequestsCount() {
            try {
                const { data } = await supabaseClient.from('creator_account_requests')
                    .select('id')
                    .eq('status', 'pending');
                updateTabBadge('accountRequestsBadge', data?.length || 0);
            } catch (err) {
                console.warn('Could not load account requests count');
            }
        }

        async function loadAccountRequests() {
            const tbody = document.getElementById('creatorsRequestsBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading...</td></tr>';

            try {
                const { data, error } = await supabaseClient.from('creator_account_requests')
                    .select('*')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });
                if (error) throw error;

                accountRequestsData = data || [];
                updateTabBadge('accountRequestsBadge', accountRequestsData.length);

                if (accountRequestsData.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);">No pending requests</td></tr>';
                    return;
                }

                tbody.innerHTML = accountRequestsData.map(r => `
                    <tr>
                        <td>${r.discord_username || r.discord_id}</td>
                        <td><code>@${r.requested_handle}</code></td>
                        <td>${r.has_existing_data ? '<span style="color: var(--warning);">⚠️ Yes</span>' : 'No'}</td>
                        <td>${new Date(r.created_at).toLocaleDateString()}</td>
                        <td style="text-align: right;">
                            <button class="btn btn-sm btn-success" onclick="approveAccountRequest('${r.id}')" style="margin-right: 4px;">✅</button>
                            <button class="btn btn-sm btn-danger" onclick="rejectAccountRequest('${r.id}')">❌</button>
                        </td>
                    </tr>
                `).join('');

            } catch (err) {
                console.error(err);
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--danger);">Failed to load requests</td></tr>';
            }
        }

        async function approveAccountRequest(id) {
            try {
                const { error } = await supabaseClient.from('creator_account_requests')
                    .update({ status: 'approved' })
                    .eq('id', id);
                if (error) throw error;
                showToast('Request approved!', 'success');
                loadAccountRequests();
            } catch (err) {
                console.error(err);
                showToast('Failed to approve request', 'error');
            }
        }

        async function rejectAccountRequest(id) {
            if (!confirm('Reject this request?')) return;
            try {
                const { error } = await supabaseClient.from('creator_account_requests')
                    .update({ status: 'rejected' })
                    .eq('id', id);
                if (error) throw error;
                showToast('Request rejected', 'warning');
                loadAccountRequests();
            } catch (err) {
                console.error(err);
                showToast('Failed to reject request', 'error');
            }
        }

        async function loadApplicationsCount() {
            try {
                const { data } = await supabaseClient.from('creator_applications')
                    .select('id')
                    .eq('status', 'pending');
                updateTabBadge('applicationsBadge', data?.length || 0);
            } catch (err) {
                console.warn('Could not load applications count');
            }
        }

        async function loadApplicationsSubTab() {
            const tbody = document.getElementById('creatorsApplicationsBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading...</td></tr>';

            try {
                const { data, error } = await supabaseClient.from('creator_applications')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(100);
                if (error) throw error;

                applicationsData = data || [];
                const pending = applicationsData.filter(a => a.status === 'pending').length;
                updateTabBadge('applicationsBadge', pending);

                if (applicationsData.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No applications</td></tr>';
                    return;
                }

                tbody.innerHTML = applicationsData.map(a => {
                    const status = a.status || 'pending';
                    const statusIcon = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⏳';
                    const statusColor = status === 'approved' ? 'var(--success)' : status === 'rejected' ? 'var(--danger)' : 'var(--warning)';
                    const hasDiscord = a.discord_id && a.discord_id.trim();
                    const displayName = a.discord_username || a.discord_name || a.name || a.first_name || 'Unknown';

                    return `
                        <tr>
                            <td>
                                <div style="font-weight: 600;">${displayName}</div>
                                ${hasDiscord ? `<div style="font-size: 0.75rem; color: var(--purple);">@${a.discord_username || a.discord_name || 'Discord linked'}</div>` : `<div style="font-size: 0.75rem; color: var(--text-muted);">❌ No Discord</div>`}
                            </td>
                            <td>${a.email || '-'}</td>
                            <td><code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">@${a.tiktok_handle || a.tiktok || '-'}</code></td>
                            <td>${a.followers ? Number(a.followers).toLocaleString() : '-'}</td>
                            <td>${a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}</td>
                            <td><span style="color: ${statusColor};">${statusIcon} ${status}</span></td>
                            <td style="text-align: right;">
                                ${status === 'pending' ? `
                                    <button class="btn btn-sm btn-success" onclick="approveApplication('${a.id}')" style="margin-right: 4px;">✅ Approve</button>
                                    <button class="btn btn-sm btn-danger" onclick="rejectApplication('${a.id}')">❌</button>
                                ` : `
                                    <button class="btn btn-sm" onclick="viewApplicationDetails('${a.id}')">👁️</button>
                                `}
                            </td>
                        </tr>
                    `;
                }).join('');

            } catch (err) {
                console.error(err);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">Failed to load applications</td></tr>';
            }
        }

        async function approveApplication(id) {
            // Get the application data
            const app = applicationsData.find(a => String(a.id) === String(id));
            if (!app) {
                showToast('Application not found', 'error');
                return;
            }

            const tiktokHandle = (app.tiktok_handle || app.tiktok || '').replace('@', '').toLowerCase().trim();
            
            if (!tiktokHandle) {
                showToast('No TikTok handle found for this application', 'error');
                return;
            }

            // Check if this handle already exists in managed_creators (all 10 account columns)
            const { data: existing, error: checkError } = await supabaseClient.from('managed_creators')
                .select('id, account_1, brand')
                .or(`account_1.ilike.${tiktokHandle},account_2.ilike.${tiktokHandle},account_3.ilike.${tiktokHandle},account_4.ilike.${tiktokHandle},account_5.ilike.${tiktokHandle},account_6.ilike.${tiktokHandle},account_7.ilike.${tiktokHandle},account_8.ilike.${tiktokHandle},account_9.ilike.${tiktokHandle},account_10.ilike.${tiktokHandle}`)
                .limit(1);
            
            if (checkError) {
                console.error('Check error:', checkError);
            }
            
            if (existing && existing.length > 0) {
                const existingRecord = existing[0];
                showToast(`@${tiktokHandle} already exists in the ${BRAND_DISPLAY[existingRecord.brand] || existingRecord.brand} roster`, 'error');
                return;
            }

            // Ask which brand to assign
            const displayName = app.discord_username || app.name || app.first_name || 'this creator';
            const brand = prompt(
                `Approve ${displayName}?\n\n` +
                `TikTok: @${tiktokHandle}\n` +
                `Discord: ${app.discord_username || 'not linked'}\n` +
                `Email: ${app.email || 'none'}\n\n` +
                `Enter brand to assign:\n` +
                `• catakor\n` +
                `• jiyu\n` +
                `• physicians_choice\n` +
                `• peach_slices\n` +
                `• yerba_magic`
            );

            if (!brand) return; // Cancelled

            const validBrands = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            const normalizedBrand = brand.toLowerCase().replace(/[- ]/g, '_');
            
            if (!validBrands.includes(normalizedBrand)) {
                showToast('Invalid brand. Please enter a valid brand name.', 'error');
                return;
            }

            try {
                // Create managed_creators record
                const insertData = {
                    account_1: tiktokHandle,
                    real_name: app.name || app.first_name || null,
                    email: app.email || null,
                    brand: normalizedBrand,
                    status: 'Active'
                };
                
                // Only add discord fields if they exist
                if (app.discord_id) {
                    insertData.discord_id = app.discord_id;
                    insertData.discord_user_id = app.discord_id;
                }
                if (app.discord_username || app.discord_name) {
                    insertData.discord_name = app.discord_username || app.discord_name;
                }
                
                console.log('Inserting managed_creator:', insertData);
                
                const { data: insertedData, error: createError } = await supabaseClient.from('managed_creators')
                    .insert(insertData)
                    .select();

                if (createError) {
                    console.error('Create error:', createError);
                    // Check if it's a duplicate
                    if (createError.message?.includes('duplicate') || createError.code === '23505') {
                        showToast('This TikTok handle or Discord already exists in the roster', 'error');
                        return;
                    }
                    throw createError;
                }
                
                console.log('Inserted successfully:', insertedData);

                // Update application status
                const { error: updateError } = await supabaseClient.from('creator_applications')
                    .update({ status: 'approved' })
                    .eq('id', String(app.id));
                
                if (updateError) {
                    console.error('Update error:', updateError);
                    // Still show success since creator was added
                    showToast(`Creator added to roster! (Note: application status update failed)`, 'warning');
                } else {
                    showToast(`Approved! ${displayName} added to ${BRAND_DISPLAY[normalizedBrand] || normalizedBrand} roster.`, 'success');
                }
                
                logActivity('create', `Approved application for ${displayName} (@${tiktokHandle}) - added to ${normalizedBrand}`);
                loadApplicationsSubTab();
                loadUsersData();

            } catch (err) {
                console.error('Error approving application:', err);
                showToast('Failed to approve: ' + (err.message || JSON.stringify(err)), 'error');
            }
        }

        async function rejectApplication(id) {
            const app = applicationsData.find(a => a.id === id);
            const reason = prompt(`Reject ${app?.name || 'this application'}?\n\nEnter reason (optional):`);
            
            if (reason === null) return; // Cancelled
            
            try {
                const { error } = await supabaseClient.from('creator_applications')
                    .update({ 
                        status: 'rejected',
                        rejection_reason: reason || null
                    })
                    .eq('id', id);
                if (error) throw error;
                showToast('Application rejected', 'warning');
                loadApplicationsSubTab();
            } catch (err) {
                console.error(err);
                showToast('Failed to reject', 'error');
            }
        }

        function viewApplicationDetails(id) {
            const app = applicationsData.find(a => a.id === id);
            if (!app) return;

            // Build a proper modal instead of alert
            const modal = document.getElementById('applicationModal');
            const modalBody = modal.querySelector('.modal-body');
            
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
            const hiddenFields = ['discord_oauth', 'discord_global_name', '_fieldLabels'];
            
            // Build ALL form answers dynamically
            const allAnswers = Object.entries(extraData)
                .filter(([key]) => !hiddenFields.includes(key))
                .filter(([key, value]) => value !== null && value !== undefined && value !== '')
                .map(([key, value]) => {
                    // Use saved label if available, otherwise format the key nicely
                    let label = fieldLabels[key];
                    if (!label) {
                        // Try to make a nice label from the key
                        label = key
                            .replace(/^field_\d+$/, 'Custom Field')
                            .replace(/^custom_\d+$/, 'Custom Field')
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, l => l.toUpperCase());
                    }
                    return { key, label, value };
                });
            
            // Separate into known fields (show first) and custom fields
            const knownFieldOrder = ['full_name', 'email', 'phone', 'tiktok_handle', 'follower_count', 'avg_views', 'content_niche', 'why_join', 'heard_about_us', 'sample_video', 'sample_video_url'];
            const knownAnswers = allAnswers.filter(a => knownFieldOrder.includes(a.key)).sort((a, b) => knownFieldOrder.indexOf(a.key) - knownFieldOrder.indexOf(b.key));
            const customAnswers = allAnswers.filter(a => !knownFieldOrder.includes(a.key));
            
            // Render answers
            const renderAnswers = (answers) => answers.map(a => {
                let displayValue = a.value;
                // Make URLs clickable
                if (typeof displayValue === 'string' && displayValue.startsWith('http')) {
                    displayValue = `<a href="${displayValue}" target="_blank" style="color: var(--accent);">View Link →</a>`;
                }
                // Format booleans
                if (typeof displayValue === 'boolean') {
                    displayValue = displayValue ? '✅ Yes' : '❌ No';
                }
                return `<div class="detail-row"><span class="detail-label">${a.label}:</span><span class="detail-value">${displayValue || '-'}</span></div>`;
            }).join('');
            
            // Update modal title with status
            const modalTitle = modal.querySelector('.modal-title');
            if (modalTitle) {
                modalTitle.innerHTML = `📋 Review Application <span style="font-size: 0.7rem; padding: 4px 10px; border-radius: 12px; margin-left: 10px; background: ${app.status === 'accepted' ? 'var(--success-dim)' : app.status === 'rejected' ? 'var(--danger-dim)' : 'var(--warning-dim)'}; color: ${app.status === 'accepted' ? 'var(--success)' : app.status === 'rejected' ? 'var(--danger)' : 'var(--warning)'};">${app.status?.toUpperCase() || 'PENDING'}</span>`;
            }
            
            modalBody.innerHTML = `
                <style>
                    .detail-section { background: var(--bg-secondary); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
                    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); }
                    .detail-row:last-child { border-bottom: none; }
                    .detail-label { color: var(--text-muted); font-size: 0.9rem; min-width: 140px; }
                    .detail-value { color: var(--text-primary); font-weight: 500; text-align: right; max-width: 55%; word-break: break-word; }
                </style>
                
                <div style="padding: 20px;">
                    <div class="detail-section">
                        <h4 style="margin-bottom: 12px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">Discord</h4>
                        <div class="detail-row"><span class="detail-label">Username:</span><span class="detail-value">${app.discord_username || '-'}</span></div>
                        <div class="detail-row"><span class="detail-label">Discord ID:</span><span class="detail-value" style="font-family: monospace; font-size: 0.85rem;">${app.discord_id || '-'}</span></div>
                    </div>
                    
                    <div class="detail-section">
                        <h4 style="margin-bottom: 12px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">Form Answers</h4>
                        ${renderAnswers(knownAnswers)}
                        ${customAnswers.length > 0 ? renderAnswers(customAnswers) : ''}
                        ${allAnswers.length === 0 ? '<div style="color: var(--text-muted); font-style: italic; padding: 12px 0;">No form data available</div>' : ''}
                    </div>
                    
                    <div class="detail-section">
                        <h4 style="margin-bottom: 12px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">Meta</h4>
                        <div class="detail-row"><span class="detail-label">Brand:</span><span class="detail-value">${BRAND_DISPLAY[app.brand] || app.brand || '-'}</span></div>
                        <div class="detail-row"><span class="detail-label">Funnel:</span><span class="detail-value">${app.funnel_slug || 'default'}</span></div>
                        <div class="detail-row"><span class="detail-label">Applied:</span><span class="detail-value">${app.created_at ? new Date(app.created_at).toLocaleString() : '-'}</span></div>
                    </div>
                    
                    ${app.notes ? `
                    <div class="detail-section">
                        <h4 style="margin-bottom: 12px; color: var(--text-muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px;">Notes</h4>
                        <p style="color: var(--text-secondary); margin: 0;">${app.notes}</p>
                    </div>
                    ` : ''}
                    
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; padding-top: 20px; border-top: 1px solid var(--border);">
                        <button class="btn" onclick="closeApplicationModal()">Close</button>
                        ${app.status === 'pending' || app.status === 'reviewing' ? `
                            <button class="btn btn-success" onclick="approveApplication('${app.id}'); closeApplicationModal();">✅ Approve</button>
                            <button class="btn btn-danger" onclick="rejectApplication('${app.id}'); closeApplicationModal();">❌ Reject</button>
                        ` : ''}
                    </div>
                </div>
            `;
            
            modal.classList.add('show');
        }
        
        function closeApplicationModal() {
            document.getElementById('applicationModal').classList.remove('show');
        }

        // ==================== BRAND CLIENTS TAB ====================
        async function loadBrandsTab() {
            const tbody = document.getElementById('brandsTableBody');
            if (!tbody) return;

            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">Loading...</td></tr>';

            try {
                const statusFilter = document.getElementById('brandsStatusFilter')?.value || 'all';
                const brandFilter = document.getElementById('brandsBrandFilter')?.value || 'all';

                let query = supabaseClient.from('brand_portal_users')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (statusFilter !== 'all') query = query.eq('status', statusFilter);
                if (brandFilter !== 'all') query = query.eq('assigned_brand', brandFilter);

                const { data, error } = await query;
                if (error) throw error;

                brandsData = data || [];
                renderBrandsTable(brandsData);

            } catch (err) {
                console.error('Error loading brand users:', err);
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--danger);">Failed to load brand users</td></tr>';
            }
        }

        function renderBrandsTable(users) {
            const tbody = document.getElementById('brandsTableBody');
            if (!users || users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">No brand users found</td></tr>';
                return;
            }

            tbody.innerHTML = users.map(u => {
                const status = u.status || 'pending';
                const statusIcon = status === 'approved' ? '✅' : status === 'denied' ? '❌' : '⏳';
                const statusColor = status === 'approved' ? 'var(--success)' : status === 'denied' ? 'var(--danger)' : 'var(--warning)';
                const brandDisplay = BRAND_DISPLAY[u.assigned_brand] || u.assigned_brand || 'Not assigned';
                const lastLogin = u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never';
                const role = u.role === 'admin' ? '👑 Admin' : '👤 User';

                return `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--blue-dim); display: flex; align-items: center; justify-content: center;">
                                    ${u.discord_avatar ? `<img src="${u.discord_avatar}" style="width: 100%; height: 100%; border-radius: 50%;">` : (u.discord_username || '?')[0].toUpperCase()}
                                </div>
                                <div>
                                    <div style="font-weight: 600;">${u.discord_username || 'Unknown'}</div>
                                    <div style="font-size: 0.8rem; color: var(--text-muted);">${u.discord_id || ''}</div>
                                </div>
                            </div>
                        </td>
                        <td>${u.discord_email || '-'}</td>
                        <td>${brandDisplay}</td>
                        <td>${role}</td>
                        <td><span style="color: ${statusColor};">${statusIcon} ${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                        <td>${lastLogin}</td>
                        <td style="text-align: right;">
                            ${status === 'pending' ? `
                                <button class="btn btn-sm btn-success" onclick="approveBrandUser('${u.id}')" style="margin-right: 4px;">✅</button>
                                <button class="btn btn-sm btn-danger" onclick="denyBrandUser('${u.id}')">❌</button>
                            ` : `
                                <button class="btn btn-sm" onclick="editBrandUser('${u.id}')">✏️</button>
                            `}
                        </td>
                    </tr>
                `;
            }).join('');
        }

        async function approveBrandUser(id) {
            const brand = prompt('Assign brand (catakor, jiyu, physicians_choice, peach_slices, yerba_magic):');
            if (!brand || !['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'].includes(brand)) {
                showToast('Invalid brand', 'error');
                return;
            }

            try {
                const { error } = await supabaseClient.from('brand_portal_users')
                    .update({ status: 'approved', assigned_brand: brand })
                    .eq('id', id);
                if (error) throw error;
                showToast('Brand user approved!', 'success');
                loadBrandsTab();
                loadUsersData();
            } catch (err) {
                console.error(err);
                showToast('Failed to approve', 'error');
            }
        }

        async function denyBrandUser(id) {
            const reason = prompt('Denial reason (optional):');
            try {
                const { error } = await supabaseClient.from('brand_portal_users')
                    .update({ status: 'denied', denied_reason: reason || null })
                    .eq('id', id);
                if (error) throw error;
                showToast('Brand user denied', 'warning');
                loadBrandsTab();
                loadUsersData();
            } catch (err) {
                console.error(err);
                showToast('Failed to deny', 'error');
            }
        }

        async function editBrandUser(id) {
            const user = brandsData.find(u => u.id == id);
            if (!user) return;

            const newBrand = prompt(`Current brand: ${user.assigned_brand || 'None'}\nNew brand (catakor, jiyu, physicians_choice, peach_slices, yerba_magic):`, user.assigned_brand || '');
            if (!newBrand) return;

            if (!['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'].includes(newBrand)) {
                showToast('Invalid brand', 'error');
                return;
            }

            try {
                const { error } = await supabaseClient.from('brand_portal_users')
                    .update({ assigned_brand: newBrand })
                    .eq('id', id);
                if (error) throw error;
                showToast('Brand updated!', 'success');
                loadBrandsTab();
            } catch (err) {
                console.error(err);
                showToast('Failed to update', 'error');
            }
        }

        function copyBrandPortalLink() {
            navigator.clipboard.writeText(window.location.origin + '/brand-portal.html');
            showToast('Link copied!', 'success');
        }

        // ==================== BRAND PORTAL USER MANAGEMENT ====================
        let allPortalUsers = [];
        
        async function loadPortalUsers() {
            showLoading('brandportal', 'Loading portal users...');
            try {
                const statusFilter = document.getElementById('portalStatusFilter')?.value || 'all';
                const brandFilter = document.getElementById('portalBrandFilter')?.value || 'all';
                
                let query = supabaseClient.from('brand_portal_users').select('*').order('created_at', { ascending: false });
                
                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }
                if (brandFilter !== 'all') {
                    query = query.eq('assigned_brand', brandFilter);
                }
                
                const { data, error } = await query;
                if (error) {
                    if (error.code === '42P01') {
                        // Table doesn't exist yet
                        document.getElementById('portalUsersBody').innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">Run brand_portal_users_table.sql migration first</td></tr>';
                        return;
                    }
                    throw error;
                }
                
                allPortalUsers = data || [];
                renderPortalUsersTable(allPortalUsers);
                updatePortalStats(allPortalUsers);
                updatePendingPortalBadge();
                
            } catch (err) {
                console.error('Error loading portal users:', err);
                showToast('Failed to load portal users', 'error');
            } finally {
                hideLoading('brandportal');
            }
        }
        
        function renderPortalUsersTable(users) {
            const tbody = document.getElementById('portalUsersBody');
            if (!tbody) return;
            
            if (!users || users.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No portal users found</td></tr>';
                return;
            }
            
            tbody.innerHTML = users.map(user => {
                const statusColors = { 'pending': 'warning', 'approved': 'success', 'denied': 'danger' };
                const statusIcons = { 'pending': '⏳', 'approved': '✅', 'denied': '🚫' };
                const status = user.status || 'pending';
                const initial = (user.discord_username || '?')[0].toUpperCase();
                const avatarUrl = user.discord_avatar;
                const brandDisplay = BRAND_DISPLAY[user.assigned_brand] || user.assigned_brand || 'Not Assigned';
                const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';
                
                return `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                ${avatarUrl ? 
                                    `<img src="${avatarUrl}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover;">` :
                                    `<div style="width: 36px; height: 36px; border-radius: 50%; background: var(--accent-dim); display: flex; align-items: center; justify-content: center; font-weight: 600; color: var(--accent);">${initial}</div>`
                                }
                                <div>
                                    <div style="font-weight: 600;">${user.discord_username || 'Unknown'}</div>
                                </div>
                            </div>
                        </td>
                        <td style="font-family: 'Space Mono', monospace; font-size: 0.8rem;">${user.discord_id || '-'}</td>
                        <td>${user.discord_email || '-'}</td>
                        <td>
                            ${status === 'approved' ? 
                                `<span class="brand-pill ${user.assigned_brand || ''}">${brandDisplay}</span>` :
                                `<select onchange="assignPortalBrand('${user.id}', this.value)" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text-primary); font-size: 0.8rem;">
                                    <option value="">Select Brand...</option>
                                    <option value="catakor" ${user.assigned_brand === 'catakor' ? 'selected' : ''}>Cata-Kor</option>
                                    <option value="jiyu" ${user.assigned_brand === 'jiyu' ? 'selected' : ''}>JiYu</option>
                                    <option value="physicians_choice" ${user.assigned_brand === 'physicians_choice' ? 'selected' : ''}>Physicians Choice</option>
                                    <option value="peach_slices" ${user.assigned_brand === 'peach_slices' ? 'selected' : ''}>Peach Slices</option>
                                    <option value="yerba_magic" ${user.assigned_brand === 'yerba_magic' ? 'selected' : ''}>Yerba Magic</option>
                                </select>`
                            }
                        </td>
                        <td>
                            <select onchange="updatePortalUserRole('${user.id}', this.value)" style="padding: 4px 8px; border-radius: 4px; border: 1px solid ${user.role === 'admin' ? 'var(--warning)' : 'var(--border)'}; background: ${user.role === 'admin' ? 'var(--warning-dim)' : 'var(--bg-secondary)'}; color: var(--text-primary); font-size: 0.8rem; font-weight: ${user.role === 'admin' ? '600' : '400'};">
                                <option value="" ${!user.role ? 'selected' : ''}>User</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>👑 Admin</option>
                            </select>
                        </td>
                        <td><span class="badge badge-${statusColors[status]}">${statusIcons[status]} ${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
                        <td style="color: var(--text-muted);">${lastLogin}</td>
                        <td>
                            <div style="display: flex; gap: 6px;">
                                ${status === 'pending' ? `
                                    <button class="btn btn-sm" style="background: var(--success); color: white;" onclick="approvePortalUser('${user.id}')">✓ Approve</button>
                                    <button class="btn btn-sm" style="background: var(--error); color: white;" onclick="denyPortalUser('${user.id}')">✗ Deny</button>
                                ` : status === 'approved' ? `
                                    <button class="btn btn-sm" onclick="denyPortalUser('${user.id}')">Revoke</button>
                                ` : `
                                    <button class="btn btn-sm" onclick="approvePortalUser('${user.id}')">Re-approve</button>
                                `}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }
        
        function updatePortalStats(users) {
            const pending = users.filter(u => u.status === 'pending').length;
            const approved = users.filter(u => u.status === 'approved').length;
            const denied = users.filter(u => u.status === 'denied').length;
            const admins = users.filter(u => u.role === 'admin').length;
            
            document.getElementById('statPendingPortal').textContent = pending;
            document.getElementById('statApprovedPortal').textContent = approved;
            document.getElementById('statDeniedPortal').textContent = denied;
            document.getElementById('statTotalPortal').textContent = users.length;
            document.getElementById('statAdminPortal').textContent = admins;
        }
        
        async function updatePendingPortalBadge() {
            try {
                const { data, error } = await supabaseClient.from('brand_portal_users').select('id').eq('status', 'pending');
                if (error) return;
                const badge = document.getElementById('pendingPortalBadge');
                if (badge) {
                    const count = (data || []).length;
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'inline-flex' : 'none';
                }
            } catch (err) {
                console.error(err);
            }
        }
        
        async function assignPortalBrand(userId, brand) {
            try {
                const { error } = await supabaseClient.from('brand_portal_users')
                    .update({ assigned_brand: brand })
                    .eq('id', userId);
                if (error) throw error;
                
                // Update local array so approve check works
                const user = allPortalUsers.find(u => u.id == userId);
                if (user) user.assigned_brand = brand;
                
                showToast('Brand assigned', 'success');
            } catch (err) {
                console.error(err);
                showToast('Failed to assign brand', 'error');
            }
        }
        
        async function updatePortalUserRole(userId, role) {
            try {
                const { error } = await supabaseClient.from('brand_portal_users')
                    .update({ role: role || null })
                    .eq('id', userId);
                if (error) throw error;
                
                // Update local array
                const user = allPortalUsers.find(u => u.id == userId);
                if (user) user.role = role || null;
                
                // Re-render to update styling
                renderPortalUsersTable(allPortalUsers);
                
                showToast(role === 'admin' ? '👑 User promoted to Admin' : 'Role updated to User', 'success');
            } catch (err) {
                console.error(err);
                showToast('Failed to update role', 'error');
            }
        }
        
        async function approvePortalUser(userId) {
            const user = allPortalUsers.find(u => u.id == userId);
            if (!user?.assigned_brand) {
                showToast('Please assign a brand first', 'warning');
                return;
            }
            try {
                const { error } = await supabaseClient.from('brand_portal_users')
                    .update({ 
                        status: 'approved', 
                        approved_by: adminName || 'Admin',
                        approved_at: new Date().toISOString()
                    })
                    .eq('id', userId);
                if (error) throw error;
                showToast('User approved! They can now access the portal.', 'success');
                loadPortalUsers();
            } catch (err) {
                console.error(err);
                showToast('Failed to approve user', 'error');
            }
        }
        
        async function denyPortalUser(userId) {
            const reason = prompt('Reason for denial (optional):');
            try {
                const { error } = await supabaseClient.from('brand_portal_users')
                    .update({ 
                        status: 'denied',
                        denied_reason: reason || null
                    })
                    .eq('id', userId);
                if (error) throw error;
                showToast('User denied', 'success');
                loadPortalUsers();
            } catch (err) {
                console.error(err);
                showToast('Failed to deny user', 'error');
            }
        }
        
        function copyPortalLink() {
            const link = window.location.origin + '/brand-portal.html';
            navigator.clipboard.writeText(link);
            showToast('Portal link copied!', 'success');
        }

