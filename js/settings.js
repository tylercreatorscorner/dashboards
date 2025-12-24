// ==================== SETTINGS ====================
        // ==================== MODALS ====================
        function openAddCreatorModal() {
            document.getElementById('modalTitle').textContent = 'Add Creator';
            document.getElementById('editCreatorId').value = '';
            document.getElementById('creatorRealName').value = '';
            document.getElementById('creatorDiscord').value = '';
            document.getElementById('creatorEmail').value = '';
            document.getElementById('creatorPhone').value = '';
            document.getElementById('creatorBrand').value = 'catakor';
            document.getElementById('creatorRole').value = 'Incubator';
            document.getElementById('creatorStatus').value = 'Active';
            document.getElementById('creatorRetainer').value = '0';
            document.getElementById('creatorMonthlyPostReq').value = '30';
            document.getElementById('creatorContractLength').value = '30';
            document.getElementById('creatorRetainerStartDate').value = '';
            updateContractSummary();
            document.getElementById('creatorLastContact').value = '';
            document.getElementById('creatorNextFollowup').value = '';
            document.getElementById('creatorAccount1').value = '';
            document.getElementById('creatorAccount2').value = '';
            document.getElementById('creatorAccount3').value = '';
            document.getElementById('creatorAccount4').value = '';
            document.getElementById('creatorAccount5').value = '';
            document.getElementById('creatorNotes').value = '';
            document.getElementById('existingCreatorHint').style.display = 'none';
            document.getElementById('crossBrandTikTokHint').style.display = 'none';
            document.getElementById('creatorPerformanceMetrics').style.display = 'none';
            crossBrandTikTokMatch = null;
            document.getElementById('creatorModal').classList.add('show');
        }

        function editCreator(id) {
            const creator = managedCreators.find(c => c.id === id);
            if (!creator) return;
            document.getElementById('modalTitle').textContent = 'Edit Creator';
            document.getElementById('editCreatorId').value = id;
            document.getElementById('creatorRealName').value = creator.real_name || '';
            document.getElementById('creatorDiscord').value = creator.discord_name || '';
            document.getElementById('creatorEmail').value = creator.email || '';
            document.getElementById('creatorPhone').value = creator.phone || '';
            document.getElementById('creatorBrand').value = creator.brand || 'catakor';
            document.getElementById('creatorRole').value = creator.role || 'Incubator';
            document.getElementById('creatorStatus').value = creator.status || 'Active';
            document.getElementById('creatorRetainer').value = creator.retainer || 0;
            document.getElementById('creatorMonthlyPostReq').value = creator.monthly_post_requirement || 30;
            document.getElementById('creatorContractLength').value = creator.contract_length_days || 30;
            document.getElementById('creatorRetainerStartDate').value = creator.retainer_start_date || '';
            updateContractSummary();
            document.getElementById('creatorLastContact').value = creator.last_contact_date || '';
            document.getElementById('creatorNextFollowup').value = creator.next_followup_date || '';
            document.getElementById('creatorDiscordChannelId').value = creator.discord_channel_id || '';
            document.getElementById('creatorDiscordUserId').value = creator.discord_user_id || '';
            document.getElementById('creatorAccount1').value = creator.account_1 || '';
            document.getElementById('creatorAccount2').value = creator.account_2 || '';
            document.getElementById('creatorAccount3').value = creator.account_3 || '';
            document.getElementById('creatorAccount4').value = creator.account_4 || '';
            document.getElementById('creatorAccount5').value = creator.account_5 || '';
            document.getElementById('creatorNotes').value = creator.notes || '';
            document.getElementById('crossBrandTikTokHint').style.display = 'none';
            crossBrandTikTokMatch = null;
            document.getElementById('creatorModal').classList.add('show');
            
            // Load performance metrics
            loadCreatorMetrics(creator.id, creator.brand, creator.account_1);
            
            // Load compensation section for this brand
            loadCompensation(creator.brand, creator.retainer || 0, creator.product_retainers || {});
        }

        function closeModal() { document.getElementById('creatorModal').classList.remove('show'); }
        
        function updateContractSummary() {
            const posts = document.getElementById('creatorMonthlyPostReq')?.value || 30;
            const days = document.getElementById('creatorContractLength')?.value || 30;
            const el = document.getElementById('contractSummary');
            if (el) {
                el.innerHTML = `<strong>${posts} posts</strong> in <strong>${days} days</strong>`;
            }
        }
        
        function setContractStartToday() {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('creatorRetainerStartDate').value = today;
            showToast('Contract start date set to today', 'success');
        }

        // ==================== RETAINER HISTORY & METRICS ====================
        
        let currentEditingCreatorId = null;
        
        async function showRetainerHistory() {
            const creatorId = document.getElementById('editCreatorId').value;
            if (!creatorId) {
                showToast('Save creator first to view history', 'warning');
                return;
            }
            
            const content = document.getElementById('retainerHistoryContent');
            content.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading...</div>';
            document.getElementById('retainerHistoryModal').classList.add('show');
            
            try {
                const { data, error } = await supabaseClient
                    .from('retainer_history')
                    .select('*')
                    .eq('creator_id', creatorId)
                    .order('changed_at', { ascending: false });
                
                if (error) throw error;
                
                if (!data || data.length === 0) {
                    content.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No retainer history found</div>';
                    return;
                }
                
                const changeIcons = {
                    'initial': '🆕',
                    'increase': '📈',
                    'decrease': '📉',
                    'removed': '❌'
                };
                
                content.innerHTML = `
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border);">
                                <th style="padding: 10px; text-align: left;">Date</th>
                                <th style="padding: 10px; text-align: left;">Change</th>
                                <th style="padding: 10px; text-align: right;">Amount</th>
                                <th style="padding: 10px; text-align: left;">By</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(h => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 10px;">${new Date(h.changed_at).toLocaleDateString()}</td>
                                    <td style="padding: 10px;">${changeIcons[h.change_type] || ''} ${h.change_type}</td>
                                    <td style="padding: 10px; text-align: right;">
                                        ${h.old_amount ? `<span style="color: var(--text-muted); text-decoration: line-through;">${fmtMoney(h.old_amount)}</span> → ` : ''}
                                        <span style="color: ${h.new_amount > 0 ? 'var(--success)' : 'var(--danger)'};">${fmtMoney(h.new_amount)}</span>
                                    </td>
                                    <td style="padding: 10px; color: var(--text-muted);">${h.changed_by || '—'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } catch (err) {
                console.error('Failed to load retainer history:', err);
                content.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);">
                    ${err.message.includes('does not exist') ? 'Retainer history table not set up yet. Run the SQL migration.' : 'Error loading history'}
                </div>`;
            }
        }
        
        function closeRetainerHistoryModal() {
            document.getElementById('retainerHistoryModal').classList.remove('show');
        }
        
        async function loadCreatorMetrics(creatorId, brand, account) {
            const metricsDiv = document.getElementById('creatorPerformanceMetrics');
            if (!creatorId) {
                metricsDiv.style.display = 'none';
                return;
            }
            
            metricsDiv.style.display = 'block';
            currentEditingCreatorId = creatorId;
            
            try {
                // Get last 90 days of performance
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                const startDate = ninetyDaysAgo.toISOString().split('T')[0];
                
                const { data: perfData } = await supabaseClient
                    .from('creator_performance')
                    .select('gmv, orders, report_date')
                    .eq('brand', brand)
                    .ilike('creator_name', account)
                    .gte('report_date', startDate);
                
                const totalGmv = (perfData || []).reduce((s, p) => s + (parseFloat(p.gmv) || 0), 0);
                const totalOrders = (perfData || []).reduce((s, p) => s + (parseInt(p.orders) || 0), 0);
                const lastActiveDate = (perfData || []).length > 0 ? 
                    Math.max(...perfData.map(p => new Date(p.report_date).getTime())) : null;
                
                document.getElementById('metricGmv').textContent = fmtMoney(totalGmv);
                document.getElementById('metricOrders').textContent = totalOrders.toLocaleString();
                
                if (lastActiveDate) {
                    const daysSinceActive = Math.floor((Date.now() - lastActiveDate) / (1000 * 60 * 60 * 24));
                    document.getElementById('metricLastActive').textContent = daysSinceActive === 0 ? 'Today' : 
                        (daysSinceActive === 1 ? 'Yesterday' : `${daysSinceActive}d ago`);
                    document.getElementById('metricLastActive').style.color = daysSinceActive > 14 ? 'var(--danger)' : 
                        (daysSinceActive > 7 ? 'var(--warning)' : 'var(--success)');
                } else {
                    document.getElementById('metricLastActive').textContent = 'Never';
                    document.getElementById('metricLastActive').style.color = 'var(--danger)';
                }
                
                // Calculate retainer ROI (GMV / Retainer)
                const retainer = parseFloat(document.getElementById('creatorRetainer').value) || 0;
                const roiX = retainer > 0 ? (totalGmv / retainer) : null;
                
                if (roiX !== null) {
                    document.getElementById('metricRetainerRoi').textContent = `${roiX.toFixed(1)}x`;
                    document.getElementById('metricRetainerRoi').style.color = 
                        roiX >= 1 ? 'var(--success)' : (roiX >= 0.5 ? 'var(--warning)' : 'var(--error)');
                } else {
                    document.getElementById('metricRetainerRoi').textContent = '—';
                    document.getElementById('metricRetainerRoi').style.color = '';
                }
                
                // Health indicator
                const healthDiv = document.getElementById('creatorHealthIndicator');
                let healthScore = 0;
                let healthIssues = [];
                
                if (totalGmv > 1000) healthScore += 2;
                else if (totalGmv > 100) healthScore += 1;
                else healthIssues.push('Low GMV');
                
                if (lastActiveDate && (Date.now() - lastActiveDate) < 7 * 24 * 60 * 60 * 1000) healthScore += 2;
                else if (lastActiveDate && (Date.now() - lastActiveDate) < 14 * 24 * 60 * 60 * 1000) healthScore += 1;
                else healthIssues.push('Inactive');
                
                if (retainer > 0) {
                    if (roiX && roiX >= 1) healthScore += 2;
                    else if (roiX && roiX >= 0.5) healthScore += 1;
                    else if (roiX && roiX < 0.5) healthIssues.push('Low ROI');
                }
                
                if (healthScore >= 4) {
                    healthDiv.innerHTML = '✅ <strong>Healthy</strong> - Keep this creator!';
                    healthDiv.style.background = 'var(--success-dim)';
                    healthDiv.style.color = 'var(--success)';
                } else if (healthScore >= 2) {
                    healthDiv.innerHTML = `⚠️ <strong>Watch</strong> - ${healthIssues.join(', ') || 'Could improve'}`;
                    healthDiv.style.background = 'var(--warning-dim)';
                    healthDiv.style.color = 'var(--warning)';
                } else {
                    healthDiv.innerHTML = `🚨 <strong>At Risk</strong> - ${healthIssues.join(', ')}. Consider action.`;
                    healthDiv.style.background = 'var(--danger-dim)';
                    healthDiv.style.color = 'var(--danger)';
                }
                
            } catch (err) {
                console.error('Failed to load metrics:', err);
            }
        }
        
        function refreshCreatorMetrics() {
            const creatorId = document.getElementById('editCreatorId').value;
            const brand = document.getElementById('creatorBrand').value;
            const account = document.getElementById('creatorAccount1').value;
            if (creatorId && account) {
                loadCreatorMetrics(creatorId, brand, account);
            }
        }

        // Check if Discord already exists in roster (for auto-fill)
        function checkExistingDiscord() {
            const discordInput = document.getElementById('creatorDiscord');
            const hint = document.getElementById('existingCreatorHint');
            const brandsSpan = document.getElementById('existingCreatorBrands');
            const editId = document.getElementById('editCreatorId').value;
            
            const discord = discordInput.value.trim();
            if (!discord) {
                hint.style.display = 'none';
                return;
            }
            
            // Find existing entries with this Discord
            const existingEntries = getCreatorByDiscord(discord);
            
            // If editing, exclude the current entry
            const otherEntries = editId 
                ? existingEntries.filter(e => e.id !== parseInt(editId))
                : existingEntries;
            
            if (otherEntries.length > 0) {
                const brands = otherEntries.map(e => BRAND_DISPLAY[e.brand] || e.brand).join(', ');
                const name = otherEntries[0].real_name || otherEntries[0].discord_name;
                brandsSpan.innerHTML = `<strong>${name}</strong> already in: ${brands}`;
                hint.style.display = 'block';
            } else {
                hint.style.display = 'none';
            }
        }
        
        // Store cross-brand match for TikTok
        let crossBrandTikTokMatch = null;
        
        function checkCrossBrandTikTok() {
            const tiktokInput = document.getElementById('creatorAccount1');
            const hint = document.getElementById('crossBrandTikTokHint');
            const infoSpan = document.getElementById('crossBrandTikTokInfo');
            const editId = document.getElementById('editCreatorId').value;
            const currentBrand = document.getElementById('creatorBrand').value;
            
            const tiktok = normalizeTikTok(tiktokInput.value);
            if (!tiktok) {
                hint.style.display = 'none';
                crossBrandTikTokMatch = null;
                return;
            }
            
            // Find existing entries with this TikTok in OTHER brands
            const match = managedCreators.find(mc => 
                mc.brand !== currentBrand &&
                (editId ? mc.id !== parseInt(editId) : true) &&
                (normalizeTikTok(mc.account_1) === tiktok ||
                 normalizeTikTok(mc.account_2) === tiktok ||
                 normalizeTikTok(mc.account_3) === tiktok ||
                 normalizeTikTok(mc.account_4) === tiktok ||
                 normalizeTikTok(mc.account_5) === tiktok)
            );
            
            if (match) {
                crossBrandTikTokMatch = match;
                const name = match.real_name || match.discord_name || '@' + tiktok;
                infoSpan.innerHTML = `<strong>${name}</strong> in ${BRAND_DISPLAY[match.brand] || match.brand}`;
                hint.style.display = 'block';
            } else {
                hint.style.display = 'none';
                crossBrandTikTokMatch = null;
            }
        }
        
        function autoFillFromTikTok() {
            if (!crossBrandTikTokMatch) {
                showToast('No cross-brand match found', 'info');
                return;
            }
            
            const match = crossBrandTikTokMatch;
            
            // Only fill empty fields
            const fillIfEmpty = (fieldId, value) => {
                const field = document.getElementById(fieldId);
                if (field && !field.value && value) {
                    field.value = value;
                }
            };
            
            fillIfEmpty('creatorRealName', match.real_name);
            fillIfEmpty('creatorDiscord', match.discord_name);
            fillIfEmpty('creatorEmail', match.email);
            fillIfEmpty('creatorPhone', match.phone);
            fillIfEmpty('creatorAccount2', match.account_2);
            fillIfEmpty('creatorAccount3', match.account_3);
            fillIfEmpty('creatorAccount4', match.account_4);
            fillIfEmpty('creatorAccount5', match.account_5);
            
            // Copy role
            if (match.role) {
                document.getElementById('creatorRole').value = match.role;
            }
            
            showToast(`Info copied from ${BRAND_DISPLAY[match.brand]} profile!`, 'success');
        }

        // Auto-fill form from existing Discord entries
        function autoFillFromDiscord() {
            const discord = document.getElementById('creatorDiscord').value.trim();
            const canonical = getCanonicalCreatorInfo(discord);
            
            if (!canonical) {
                showToast('No existing info found', 'info');
                return;
            }
            
            // Only fill empty fields (don't overwrite user input)
            const fillIfEmpty = (fieldId, value) => {
                const field = document.getElementById(fieldId);
                if (field && !field.value && value) {
                    field.value = value;
                }
            };
            
            fillIfEmpty('creatorRealName', canonical.real_name);
            fillIfEmpty('creatorEmail', canonical.email);
            fillIfEmpty('creatorPhone', canonical.phone);
            fillIfEmpty('creatorAccount1', canonical.account_1);
            fillIfEmpty('creatorAccount2', canonical.account_2);
            fillIfEmpty('creatorAccount3', canonical.account_3);
            fillIfEmpty('creatorAccount4', canonical.account_4);
            fillIfEmpty('creatorAccount5', canonical.account_5);
            
            // Copy role if it's set
            if (canonical.role) {
                document.getElementById('creatorRole').value = canonical.role;
            }
            
            showToast('Info copied from existing profile!', 'success');
        }

        async function saveCreator() {
            const id = document.getElementById('editCreatorId').value;
            const validationError = document.getElementById('creatorValidationError');
            const validationMessage = document.getElementById('creatorValidationMessage');
            
            // Hide previous errors
            validationError.style.display = 'none';
            
            // Get values
            const realName = document.getElementById('creatorRealName').value.trim();
            const discordName = normalizeDiscord(document.getElementById('creatorDiscord').value);
            const account1Raw = document.getElementById('creatorAccount1').value;
            const retainer = parseFloat(document.getElementById('creatorRetainer').value) || 0;
            
            // Collect missing required fields
            const missingFields = [];
            
            if (!discordName) {
                missingFields.push('Discord Name');
                document.getElementById('creatorDiscord').style.borderColor = 'var(--danger)';
            } else {
                document.getElementById('creatorDiscord').style.borderColor = '';
            }
            
            if (!account1Raw.trim()) {
                missingFields.push('Primary TikTok Account');
                document.getElementById('creatorAccount1').style.borderColor = 'var(--danger)';
            } else {
                document.getElementById('creatorAccount1').style.borderColor = '';
            }
            
            // Show validation error if missing required fields
            if (missingFields.length > 0) {
                validationMessage.textContent = missingFields.join(', ');
                validationError.style.display = 'block';
                validationError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            
            // TikTok username validation (strip @ and validate format)
            const cleanUsername = (u) => {
                if (!u) return null;
                let clean = normalizeTikTok(u);
                // TikTok usernames: 2-24 chars, letters, numbers, underscores, periods
                if (clean && !/^[a-z0-9_.]{2,24}$/.test(clean)) {
                    return { error: `Invalid TikTok username: ${u}` };
                }
                return clean || null;
            };
            
            const acc1 = cleanUsername(document.getElementById('creatorAccount1').value);
            const acc2 = cleanUsername(document.getElementById('creatorAccount2').value);
            const acc3 = cleanUsername(document.getElementById('creatorAccount3').value);
            const acc4 = cleanUsername(document.getElementById('creatorAccount4').value);
            const acc5 = cleanUsername(document.getElementById('creatorAccount5').value);
            
            if (acc1?.error) { showToast(acc1.error, 'error'); return; }
            if (acc2?.error) { showToast(acc2.error, 'error'); return; }
            if (acc3?.error) { showToast(acc3.error, 'error'); return; }
            if (acc4?.error) { showToast(acc4.error, 'error'); return; }
            if (acc5?.error) { showToast(acc5.error, 'error'); return; }
            
            // Retainer validation
            if (retainer < 0) {
                showToast('Retainer cannot be negative', 'error');
                return;
            }
            if (retainer > 50000) {
                if (!confirm(`Retainer of ${fmtMoney(retainer)}/month seems high. Continue?`)) return;
            }
            
            // Check for duplicate accounts within the SAME brand (allow same creator across different brands)
            const selectedBrand = document.getElementById('creatorBrand').value;
            if (acc1) {
                const existingCreator = managedCreators.find(c => 
                    c.id != id && 
                    c.brand === selectedBrand && 
                    (c.account_1 === acc1 || c.account_2 === acc1 || c.account_3 === acc1 || c.account_4 === acc1 || c.account_5 === acc1)
                );
                if (existingCreator) {
                    showToast(`Account @${acc1} is already assigned to ${existingCreator.real_name || existingCreator.discord_name || 'another creator'} for ${BRAND_DISPLAY[selectedBrand]}`, 'error');
                    return;
                }
                
                // If same account exists for different brand, show info (not error)
                const otherBrandCreator = managedCreators.find(c => 
                    c.id != id && 
                    c.brand !== selectedBrand && 
                    (c.account_1 === acc1 || c.account_2 === acc1 || c.account_3 === acc1 || c.account_4 === acc1 || c.account_5 === acc1)
                );
                if (otherBrandCreator && !id) {
                    // Only show on new entries, not edits
                    showToast(`Note: @${acc1} also works with ${BRAND_DISPLAY[otherBrandCreator.brand]}`, 'info');
                }
            }
            
            const data = {
                real_name: realName || null,
                discord_name: discordName,
                email: document.getElementById('creatorEmail').value.trim() || null,
                phone: document.getElementById('creatorPhone').value.trim() || null,
                brand: document.getElementById('creatorBrand').value,
                role: document.getElementById('creatorRole').value,
                status: document.getElementById('creatorStatus').value,
                retainer: retainer,
                monthly_post_requirement: parseInt(document.getElementById('creatorMonthlyPostReq').value) || 30,
                contract_length_days: parseInt(document.getElementById('creatorContractLength').value) || 30,
                retainer_start_date: document.getElementById('creatorRetainerStartDate').value || null,
                last_contact_date: document.getElementById('creatorLastContact').value || null,
                next_followup_date: document.getElementById('creatorNextFollowup').value || null,
                discord_channel_id: document.getElementById('creatorDiscordChannelId').value.trim() || null,
                discord_user_id: document.getElementById('creatorDiscordUserId').value.trim() || null,
                account_1: acc1,
                account_2: acc2,
                account_3: acc3,
                account_4: acc4,
                account_5: acc5,
                notes: document.getElementById('creatorNotes').value.trim() || null,
                updated_by: adminName || 'Admin',
                product_assignments: getSelectedProductAssignments(),
                product_retainers: getProductRetainers()
            };

            let error, newId;
            let oldData = null;
            
            if (id) {
                // Get old data for audit log
                oldData = managedCreators.find(c => c.id === parseInt(id));
                ({ error } = await supabaseClient.from('managed_creators').update(data).eq('id', id));
                newId = id;
            } else {
                data.created_by = adminName || 'Admin';
                const result = await supabaseClient.from('managed_creators').insert([data]).select('id').single();
                error = result.error;
                newId = result.data?.id;
            }

            if (error) { showToast('Error: ' + error.message, 'error'); return; }
            
            // Log to audit table (if it exists)
            try {
                await supabaseClient.from('roster_audit_log').insert({
                    managed_creator_id: parseInt(newId),
                    action: id ? 'update' : 'create',
                    changed_by: adminName || 'Admin',
                    old_values: oldData ? {
                        discord_name: oldData.discord_name,
                        real_name: oldData.real_name,
                        email: oldData.email,
                        role: oldData.role,
                        status: oldData.status,
                        account_1: oldData.account_1
                    } : null,
                    new_values: {
                        discord_name: data.discord_name,
                        real_name: data.real_name,
                        email: data.email,
                        role: data.role,
                        status: data.status,
                        account_1: data.account_1
                    },
                    notes: id ? 'Updated via roster modal' : 'Created via roster modal'
                });
            } catch (auditErr) {
                // Audit table might not exist yet - that's ok
                console.log('Audit log skipped (table may not exist):', auditErr.message);
            }
            
            // Track retainer changes
            try {
                const oldRetainer = oldData?.retainer || 0;
                const newRetainer = data.retainer || 0;
                
                if (oldRetainer !== newRetainer) {
                    let changeType = 'initial';
                    if (oldData) {
                        if (newRetainer === 0) changeType = 'removed';
                        else if (newRetainer > oldRetainer) changeType = 'increase';
                        else changeType = 'decrease';
                    }
                    
                    await supabaseClient.from('retainer_history').insert({
                        creator_id: parseInt(newId),
                        brand: data.brand,
                        old_amount: oldRetainer,
                        new_amount: newRetainer,
                        change_type: changeType,
                        changed_by: adminName || 'Admin'
                    });
                    
                    if (changeType !== 'initial') {
                        const changeText = changeType === 'removed' ? 'removed' : 
                            (changeType === 'increase' ? `increased from ${fmtMoney(oldRetainer)} to ${fmtMoney(newRetainer)}` : 
                            `decreased from ${fmtMoney(oldRetainer)} to ${fmtMoney(newRetainer)}`);
                        showToast(`Retainer ${changeText}`, 'info');
                    }
                }
            } catch (retainerErr) {
                console.log('Retainer history skipped (table may not exist):', retainerErr.message);
            }
            
            closeModal();
            showToast(id ? 'Creator updated' : 'Creator added', 'success');
            logActivity(id ? 'edit' : 'add', `${id ? 'Updated' : 'Added'} creator: ${data.real_name || data.discord_name}`, data.brand);
            await loadManagedCreators();
            loadRosterData();
            loadOverviewData();
            // Also refresh Creators view if it's been loaded
            if (window.creatorsDataLoaded) loadCreatorsData();
            // Also refresh Posting view if it's been loaded
            if (window.postingDataLoaded) loadPostingData();
        }

        async function deleteCreator(id, name) {
            if (!confirm(`Remove ${name} from roster?`)) return;
            
            // Get old data for audit
            const oldData = managedCreators.find(c => c.id === id);
            
            const { error } = await supabaseClient.from('managed_creators').delete().eq('id', id);
            if (error) { showToast('Error: ' + error.message, 'error'); return; }
            
            // Log deletion
            try {
                await supabaseClient.from('roster_audit_log').insert({
                    managed_creator_id: id,
                    action: 'delete',
                    changed_by: adminName || 'Admin',
                    old_values: oldData ? {
                        discord_name: oldData.discord_name,
                        real_name: oldData.real_name,
                        brand: oldData.brand,
                        account_1: oldData.account_1
                    } : null,
                    notes: `Deleted ${name}`
                });
            } catch (auditErr) {
                console.log('Audit log skipped:', auditErr.message);
            }
            
            showToast('Creator removed', 'success');
            logActivity('delete', `Removed creator: ${name}`, oldData?.brand);
            await loadManagedCreators();
            loadRosterData();
            loadOverviewData();
        }

        async function quickAddToRoster(username, brand) {
            // Open the Add Creator modal with pre-filled data
            // This ensures Discord and other required fields are captured
            openAddCreatorModal();
            
            // Pre-fill the TikTok account and brand
            document.getElementById('creatorAccount1').value = normalizeTikTok(username) || '';
            document.getElementById('creatorBrand').value = brand || 'catakor';
            
            // Focus on the Discord field since that's required
            setTimeout(() => {
                document.getElementById('creatorDiscord').focus();
            }, 100);
            
            showToast('Please fill in Discord name to complete adding this creator', 'info');
        }

        // Goal Modal
        function openGoalModal() { document.getElementById('goalModal').classList.add('show'); }
        function closeGoalModal() { document.getElementById('goalModal').classList.remove('show'); }

        document.getElementById('goalType').addEventListener('change', (e) => {
            document.getElementById('goalBrandGroup').style.display = e.target.value === 'brand' ? 'block' : 'none';
        });

        async function saveGoal() {
            const goalType = document.getElementById('goalType').value;
            const targetGmv = parseFloat(document.getElementById('goalTargetGmv').value) || 0;
            const periodType = document.getElementById('goalPeriod').value;
            
            // Validation
            if (targetGmv <= 0) {
                showToast('Please enter a target GMV greater than $0', 'error');
                return;
            }
            
            if (targetGmv > 10000000) {
                showToast('Target GMV seems unrealistically high. Please check your value.', 'error');
                return;
            }
            
            // Calculate period dates based on period type
            const today = new Date();
            let periodEnd = new Date();
            
            switch (periodType) {
                case 'daily':
                    // End of today
                    break;
                case 'weekly':
                    periodEnd.setDate(periodEnd.getDate() + 7);
                    break;
                case 'monthly':
                    periodEnd.setMonth(periodEnd.getMonth() + 1);
                    break;
                case 'quarterly':
                    periodEnd.setMonth(periodEnd.getMonth() + 3);
                    break;
                default:
                    periodEnd.setDate(periodEnd.getDate() + 30);
            }
            
            const targetEntity = goalType === 'brand' ? document.getElementById('goalBrand').value : null;
            
            // Check for duplicate active goals
            const { data: existingGoals } = await supabaseClient.from('goals')
                .select('*')
                .eq('goal_type', goalType)
                .eq('period_type', periodType)
                .gte('period_end', localDateStr(today));
            
            if (existingGoals && existingGoals.length > 0) {
                const duplicate = existingGoals.find(g => 
                    (goalType === 'overall') || 
                    (goalType === 'brand' && g.target_entity === targetEntity)
                );
                if (duplicate) {
                    if (!confirm(`An active ${periodType} goal already exists for ${goalType === 'brand' ? BRAND_DISPLAY[targetEntity] : 'all brands'}. Create another?`)) {
                        return;
                    }
                }
            }
            
            const data = {
                goal_type: goalType,
                target_entity: targetEntity,
                period_type: periodType,
                period_start: localDateStr(today),
                period_end: localDateStr(periodEnd),
                target_gmv: targetGmv
            };

            const { error } = await supabaseClient.from('goals').insert([data]);
            if (error) { showToast('Error: ' + error.message, 'error'); return; }
            closeGoalModal();
            showToast('Goal created', 'success');
            loadGoalsData();
        }

        async function markAllAlertsRead() {
            await supabaseClient.from('alerts').update({ is_read: true }).eq('is_read', false);
            loadAlertsData();
            showToast('All alerts marked as read', 'success');
        }

        // ==================== COMMISSION CALCULATOR ====================
        let calculatedPayouts = [];

        async function initCalculator() {
            // Load brand settings from database
            await loadBrandSettings();
            // Initialize month dropdown for revenue share
            populateRevShareMonths();
        }

        // ==================== REVENUE SHARE CALCULATOR ====================
        // Brand settings cached from database
        let brandSettingsCache = null;
        
        async function loadBrandSettings() {
            try {
                const { data, error } = await supabaseClient
                    .from('brand_settings')
                    .select('brand, commission_rate, retainer, launch_fee, launch_fee_name, launch_fee_ends');
                
                if (error) throw error;
                
                // Convert to lookup objects
                brandSettingsCache = {
                    rates: {},
                    retainers: {},
                    launchFees: {}
                };
                
                const today = new Date().toISOString().split('T')[0];
                
                (data || []).forEach(row => {
                    brandSettingsCache.rates[row.brand] = parseFloat(row.commission_rate) || 2.5;
                    brandSettingsCache.retainers[row.brand] = parseFloat(row.retainer) || 0;
                    
                    // Only include launch fee if it hasn't expired
                    const feeEnds = row.launch_fee_ends;
                    const isActive = !feeEnds || feeEnds >= today;
                    
                    brandSettingsCache.launchFees[row.brand] = {
                        amount: isActive ? (parseFloat(row.launch_fee) || 0) : 0,
                        name: row.launch_fee_name || '',
                        ends: row.launch_fee_ends || '',
                        isActive: isActive && (parseFloat(row.launch_fee) || 0) > 0
                    };
                });
                
                return brandSettingsCache;
            } catch (err) {
                console.error('Failed to load brand settings:', err);
                return { rates: {}, retainers: {}, launchFees: {} };
            }
        }
        
        function getRevShareRates() {
            return brandSettingsCache?.rates || {};
        }
        
        async function saveRevShareRate(brand, rate) {
            try {
                const { error } = await supabaseClient
                    .from('brand_settings')
                    .update({ commission_rate: rate, updated_at: new Date().toISOString() })
                    .eq('brand', brand);
                
                if (error) throw error;
                
                // Update cache
                if (brandSettingsCache) {
                    brandSettingsCache.rates[brand] = rate;
                }
            } catch (err) {
                console.error('Failed to save commission rate:', err);
                showToast('Failed to save rate: ' + err.message, 'error');
            }
        }
        
        function getRetainers() {
            return brandSettingsCache?.retainers || {};
        }
        
        async function saveRetainer(brand, amount) {
            try {
                const { error } = await supabaseClient
                    .from('brand_settings')
                    .update({ retainer: amount, updated_at: new Date().toISOString() })
                    .eq('brand', brand);
                
                if (error) throw error;
                
                // Update cache
                if (brandSettingsCache) {
                    brandSettingsCache.retainers[brand] = amount;
                }
            } catch (err) {
                console.error('Failed to save retainer:', err);
                showToast('Failed to save retainer: ' + err.message, 'error');
            }
        }
        
        function populateRevShareMonths() {
            const select = document.getElementById('revShareMonth');
            if (!select) return;
            
            const months = [];
            const now = new Date();
            
            // Last 12 months
            for (let i = 0; i < 12; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                months.push({ value, label });
            }
            
            select.innerHTML = months.map((m, i) => 
                `<option value="${m.value}" ${i === 1 ? 'selected' : ''}>${m.label}</option>`
            ).join('');
        }
        
        async function calculateRevenueShare() {
            const monthValue = document.getElementById('revShareMonth')?.value;
            if (!monthValue) return;
            
            // Load brand settings from database if not cached
            if (!brandSettingsCache) {
                await loadBrandSettings();
            }
            
            const [year, month] = monthValue.split('-').map(Number);
            const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
            
            // Define brands
            const brands = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            
            // Show loading state
            const tbody = document.getElementById('revShareBody');
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" style="text-align: center; padding: 60px;">
                        <div style="font-size: 2rem; margin-bottom: 12px;">⏳</div>
                        <div id="loadingText" style="font-weight: 600; color: var(--text-primary);">Loading data...</div>
                        <div id="loadingProgress" style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">Fetching page 1...</div>
                    </td>
                </tr>
            `;
            
            // Reset summary while loading
            document.getElementById('revTotalGmv').textContent = '...';
            document.getElementById('revTotalShare').textContent = '...';
            document.getElementById('revTotalRetainers').textContent = '...';
            document.getElementById('revTotalEarnings').textContent = '...';
            document.getElementById('revTylerShare').textContent = '...';
            document.getElementById('revMattShare').textContent = '...';
            document.getElementById('revShareFooter').style.display = 'none';
            
            // Reset goal tracker while loading
            document.getElementById('goalCurrentAmount').textContent = '...';
            document.getElementById('goalPercentText').textContent = 'Calculating...';
            document.getElementById('goalProgressText').textContent = 'Loading...';
            
            try {
                // Get ALL performance data - paginate with 1000 row limit
                let allPerfData = [];
                let page = 0;
                const pageSize = QUERY_PAGE_SIZE; // Supabase max per query
                let hasMore = true;
                
                while (hasMore) {
                    // Update loading progress
                    const progressEl = document.getElementById('loadingProgress');
                    if (progressEl) {
                        progressEl.textContent = `Fetching page ${page + 1}... (${allPerfData.length.toLocaleString()} rows so far)`;
                    }
                    
                    const { data: perfData, error: perfError } = await supabaseClient
                        .from('creator_performance')
                        .select('creator_name, brand, gmv, orders')
                        .gte('report_date', startDate)
                        .lte('report_date', endDate)
                        .eq('period_type', 'daily')
                        .range(page * pageSize, (page + 1) * pageSize - 1);
                    
                    if (perfError) throw perfError;
                    
                    if (perfData && perfData.length > 0) {
                        allPerfData = allPerfData.concat(perfData);
                        page++;
                        hasMore = perfData.length === pageSize; // Continue if we got a full page
                    } else {
                        hasMore = false;
                    }
                }
                
                // Update loading to show calculating
                const progressEl = document.getElementById('loadingProgress');
                if (progressEl) {
                    progressEl.textContent = `Calculating from ${allPerfData.length.toLocaleString()} rows...`;
                }
                
                console.log('Total performance rows fetched:', allPerfData.length);
                
                // Build managed creators lookup using normalizeTikTok for consistent matching
                const managedLookup = new Set();
                managedCreators.forEach(mc => {
                    [mc.account_1, mc.account_2, mc.account_3, mc.account_4, mc.account_5].forEach(acct => {
                        const normalized = normalizeTikTok(acct);
                        if (normalized) managedLookup.add(`${normalized}|||${mc.brand}`);
                    });
                });
                
                // Aggregate GMV by brand AND build creator-level data (managed creators only)
                const brandTotals = {};
                const creatorGmvByBrand = {}; // Move this up to calculate commission properly
                brands.forEach(b => {
                    brandTotals[b] = 0;
                    creatorGmvByBrand[b] = {};
                });
                
                allPerfData.forEach(row => {
                    const normalized = normalizeTikTok(row.creator_name);
                    if (!normalized) return;
                    const key = `${normalized}|||${row.brand}`;
                    if (managedLookup.has(key)) {
                        brandTotals[row.brand] = (brandTotals[row.brand] || 0) + (parseFloat(row.gmv) || 0);
                        
                        // Build creator-level data
                        if (!creatorGmvByBrand[row.brand][normalized]) {
                            creatorGmvByBrand[row.brand][normalized] = { 
                                creator_name: row.creator_name, 
                                normalized: normalized,
                                brand: row.brand,
                                gmv: 0, 
                                orders: 0 
                            };
                        }
                        creatorGmvByBrand[row.brand][normalized].gmv += parseFloat(row.gmv) || 0;
                        creatorGmvByBrand[row.brand][normalized].orders += parseInt(row.orders) || 0;
                    }
                });
                
                // Get rates and retainers
                const rates = getRevShareRates();
                const retainers = getRetainers();
                const launchFees = brandSettingsCache?.launchFees || {};
                const marketingGmvData = getMarketingGmv(monthValue);
                
                // Calculate commission per brand by summing individual creator commissions
                // This respects custom creator rates (e.g., 1% for select Cata-Kor creators)
                function calculateBrandCommission(brand, affiliateGmv, marketingGmv) {
                    const brandRate = (rates[brand] || 2) / 100;
                    let creatorCommission = 0;
                    
                    // Sum individual creator commissions (respecting custom rates)
                    const brandCreators = creatorGmvByBrand[brand] || {};
                    for (const creator of Object.values(brandCreators)) {
                        const creatorRate = getCreatorRate(brand, creator.creator_name);
                        creatorCommission += creator.gmv * creatorRate;
                    }
                    
                    // Marketing GMV always uses 1% rate (not brand rate)
                    const marketingCommission = marketingGmv * 0.01;
                    
                    return {
                        affiliateCommission: creatorCommission,
                        marketingCommission: marketingCommission,
                        totalCommission: creatorCommission + marketingCommission,
                        effectiveRate: affiliateGmv > 0 ? (creatorCommission / affiliateGmv) : brandRate
                    };
                }
                
                // Calculate splits
                let totalAffiliateGmv = 0;
                let totalMarketingGmv = 0;
                let totalGmv = 0;
                let totalCommission = 0;
                let totalRetainers = 0;
                let totalLaunchFees = 0;
                
                const brandRows = brands.map(brand => {
                    const affiliateGmv = brandTotals[brand] || 0;
                    const marketingGmv = marketingGmvData[brand] || 0;
                    const gmv = affiliateGmv + marketingGmv;
                    const brandRate = rates[brand] || 2;
                    
                    // Calculate commission using individual creator rates
                    const commissionCalc = calculateBrandCommission(brand, affiliateGmv, marketingGmv);
                    const commission = commissionCalc.totalCommission;
                    const effectiveRate = gmv > 0 ? (commission / gmv) * 100 : brandRate;
                    
                    const retainer = retainers[brand] || 0;
                    const launchFee = launchFees[brand] || { amount: 0, name: '', ends: '', isActive: false };
                    const totalFees = retainer + launchFee.amount;
                    const total = commission + totalFees;
                    const tyler = total / 2;
                    const matt = total / 2;
                    
                    totalAffiliateGmv += affiliateGmv;
                    totalMarketingGmv += marketingGmv;
                    totalGmv += gmv;
                    totalCommission += commission;
                    totalRetainers += retainer;
                    totalLaunchFees += launchFee.amount;
                    
                    return { brand, affiliateGmv, marketingGmv, gmv, rate: brandRate, effectiveRate, commission, retainer, launchFee, totalFees, total, tyler, matt };
                });
                
                const totalEarnings = totalCommission + totalRetainers + totalLaunchFees;
                const tylerTotal = totalEarnings / 2;
                const mattTotal = totalEarnings / 2;
                
                // Update summary
                document.getElementById('revTotalGmv').textContent = fmtMoney(totalGmv);
                document.getElementById('revTotalShare').textContent = fmtMoney(totalCommission);
                document.getElementById('revTotalRetainers').textContent = fmtMoney(totalRetainers);
                document.getElementById('revTotalLaunchFees').textContent = fmtMoney(totalLaunchFees);
                document.getElementById('revTotalEarnings').textContent = fmtMoney(totalEarnings);
                document.getElementById('revTylerShare').textContent = fmtMoney(tylerTotal);
                document.getElementById('revMattShare').textContent = fmtMoney(mattTotal);
                
                // Update goal tracker with monthly total earnings
                updateGoalUI(totalEarnings);
                
                // Render table
                const tbody = document.getElementById('revShareBody');
                tbody.innerHTML = brandRows.map(row => {
                    const launchFeeDisplay = row.launchFee.isActive 
                        ? `<div style="font-size: 0.75rem; color: var(--info);">
                             ${row.launchFee.name || 'Launch Fee'}
                             <br><span style="color: var(--text-muted);">ends ${row.launchFee.ends || 'TBD'}</span>
                           </div>`
                        : '';
                    
                    return `
                    <tr>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--accent-dim); display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                                    ${BRAND_ICONS[row.brand] || '🏷️'}
                                </div>
                                <span style="font-weight: 600;">${BRAND_DISPLAY[row.brand] || row.brand}</span>
                            </div>
                        </td>
                        <td style="text-align: right; font-weight: 500; color: var(--accent);">${fmtMoney(row.affiliateGmv)}</td>
                        <td style="text-align: right;">
                            $<input type="number" 
                                value="${row.marketingGmv}" 
                                min="0" max="10000000" step="100" 
                                style="width: 90px; text-align: right; background: var(--bg-secondary); border: 1px solid var(--purple); border-radius: 6px; padding: 4px 8px; color: var(--purple); font-weight: 600;"
                                onchange="updateMarketingGmv('${row.brand}', this.value)"
                                title="Marketing account GMV (manual entry)"
                            >
                        </td>
                        <td style="text-align: right; font-weight: 600; color: var(--accent);">${fmtMoney(row.gmv)}</td>
                        <td style="text-align: center;">
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                                <div style="display: flex; align-items: center; gap: 2px;">
                                    <input type="number" 
                                        value="${row.rate}" 
                                        min="0" max="10" step="0.5" 
                                        style="width: 50px; text-align: center; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 6px; padding: 4px 6px; color: var(--text-primary); font-weight: 600; font-size: 0.85rem;"
                                        onchange="updateBrandRate('${row.brand}', this.value)"
                                        title="Base brand rate"
                                    >%
                                </div>
                                ${Math.abs(row.effectiveRate - row.rate) > 0.01 ? `
                                    <div style="font-size: 0.7rem; color: var(--accent);" title="Effective rate after custom creator rates">
                                        eff: ${row.effectiveRate.toFixed(2)}%
                                    </div>
                                ` : ''}
                            </div>
                        </td>
                        <td style="text-align: right; color: var(--success);">${fmtMoney(row.commission)}</td>
                        <td style="text-align: center;">
                            $<input type="number" 
                                value="${row.retainer}" 
                                min="0" max="100000" step="100" 
                                style="width: 80px; text-align: center; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 6px; padding: 4px 8px; color: var(--text-primary); font-weight: 600;"
                                onchange="updateBrandRetainer('${row.brand}', this.value)"
                            >
                        </td>
                        <td style="text-align: center;">
                            <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                                <div style="display: flex; align-items: center; gap: 4px;">
                                    $<input type="number" 
                                        value="${row.launchFee.amount}" 
                                        min="0" max="100000" step="100" 
                                        style="width: 80px; text-align: center; background: var(--bg-secondary); border: 1px solid ${row.launchFee.isActive ? 'var(--info)' : 'var(--border-light)'}; border-radius: 6px; padding: 4px 8px; color: ${row.launchFee.isActive ? 'var(--info)' : 'var(--text-primary)'}; font-weight: 600;"
                                        onchange="openLaunchFeeModal('${row.brand}', this.value)"
                                        title="Click to set launch fee details"
                                    >
                                </div>
                                ${launchFeeDisplay}
                            </div>
                        </td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">${fmtMoney(row.total)}</td>
                        <td style="text-align: right; color: var(--blue);">${fmtMoney(row.tyler)}</td>
                        <td style="text-align: right; color: var(--purple);">${fmtMoney(row.matt)}</td>
                    </tr>
                `}).join('');
                
                // Update footer
                document.getElementById('revShareFooter').style.display = 'table-footer-group';
                document.getElementById('footerAffiliateGmv').textContent = fmtMoney(totalAffiliateGmv);
                document.getElementById('footerMarketingGmv').textContent = fmtMoney(totalMarketingGmv);
                document.getElementById('footerGmv').textContent = fmtMoney(totalGmv);
                document.getElementById('footerCommission').textContent = fmtMoney(totalCommission);
                document.getElementById('footerRetainer').textContent = fmtMoney(totalRetainers);
                document.getElementById('footerLaunchFee').textContent = fmtMoney(totalLaunchFees);
                document.getElementById('footerTotal').textContent = fmtMoney(totalEarnings);
                document.getElementById('footerTyler').textContent = fmtMoney(tylerTotal);
                document.getElementById('footerMatt').textContent = fmtMoney(mattTotal);
                
                // Build top creators by brand for invoices (all creators, sorted by GMV)
                const topCreatorsByBrand = {};
                for (const brand of brands) {
                    if (creatorGmvByBrand[brand]) {
                        topCreatorsByBrand[brand] = Object.values(creatorGmvByBrand[brand])
                            .sort((a, b) => b.gmv - a.gmv);
                    } else {
                        topCreatorsByBrand[brand] = [];
                    }
                }
                
                // Cache data for exports
                cachedEarningsData = {
                    brandRows,
                    totalAffiliateGmv,
                    totalMarketingGmv,
                    totalGmv,
                    totalCommission,
                    totalRetainers,
                    totalLaunchFees,
                    totalEarnings,
                    tylerTotal,
                    mattTotal,
                    topCreatorsByBrand,
                    creatorGmvByBrand // Full creator breakdown
                };
                
                // Render creator breakdown table
                renderCreatorBreakdown();
                
            } catch (err) {
                console.error('Failed to calculate revenue share:', err);
                showToast('Failed to calculate: ' + err.message, 'error');
            }
        }
        
        // ==================== CREATOR BREAKDOWN ====================
        // Custom creator rates stored in localStorage (creator_name -> rate override)
        // Format: { 'catakor': { 'creatorhandle': 0.01, ... }, ... }
        let customCreatorRates = JSON.parse(localStorage.getItem('customCreatorRates') || '{}');
        
        function getCreatorRate(brand, creatorName) {
            const brandRates = customCreatorRates[brand] || {};
            const normalized = normalizeTikTok(creatorName);
            if (brandRates[normalized] !== undefined) {
                return brandRates[normalized];
            }
            // Fall back to brand rate
            const brandRate = getRevShareRates()[brand] || 2;
            return brandRate / 100; // Convert percentage to decimal
        }
        
        function setCreatorRate(brand, creatorName, rate) {
            if (!customCreatorRates[brand]) customCreatorRates[brand] = {};
            const normalized = normalizeTikTok(creatorName);
            
            // Get brand default rate
            const brandRate = (getRevShareRates()[brand] || 2) / 100;
            
            if (rate === brandRate) {
                // If same as brand default, remove override
                delete customCreatorRates[brand][normalized];
                if (Object.keys(customCreatorRates[brand]).length === 0) {
                    delete customCreatorRates[brand];
                }
            } else {
                customCreatorRates[brand][normalized] = rate;
            }
            
            localStorage.setItem('customCreatorRates', JSON.stringify(customCreatorRates));
            
            // Recalculate brand breakdown with new rates
            recalculateBrandTotals();
            renderCreatorBreakdown();
            showToast(`${creatorName} rate updated to ${(rate * 100).toFixed(1)}%`, 'success');
        }
        
        // Recalculate brand totals without refetching data
        function recalculateBrandTotals() {
            if (!cachedEarningsData?.creatorGmvByBrand) return;
            
            const brands = ['catakor', 'jiyu', 'physicians_choice', 'peach_slices', 'yerba_magic'];
            const rates = getRevShareRates();
            const retainers = getRetainers();
            const launchFees = brandSettingsCache?.launchFees || {};
            const monthValue = document.getElementById('revShareMonth')?.value;
            const marketingGmvData = getMarketingGmv(monthValue);
            const creatorGmvByBrand = cachedEarningsData.creatorGmvByBrand;
            
            let totalAffiliateGmv = 0;
            let totalMarketingGmv = 0;
            let totalGmv = 0;
            let totalCommission = 0;
            let totalRetainers = 0;
            let totalLaunchFees = 0;
            
            const brandRows = brands.map(brand => {
                // Sum affiliate GMV from creators
                const brandCreators = creatorGmvByBrand[brand] || {};
                let affiliateGmv = 0;
                let creatorCommission = 0;
                
                for (const creator of Object.values(brandCreators)) {
                    affiliateGmv += creator.gmv;
                    const creatorRate = getCreatorRate(brand, creator.creator_name);
                    creatorCommission += creator.gmv * creatorRate;
                }
                
                const marketingGmv = marketingGmvData[brand] || 0;
                const brandRate = (rates[brand] || 2) / 100;
                const marketingCommission = marketingGmv * 0.01; // Marketing always 1%
                
                const gmv = affiliateGmv + marketingGmv;
                const commission = creatorCommission + marketingCommission;
                const effectiveRate = gmv > 0 ? (commission / gmv) * 100 : (rates[brand] || 2);
                
                const retainer = retainers[brand] || 0;
                const launchFee = launchFees[brand] || { amount: 0, name: '', ends: '', isActive: false };
                const total = commission + retainer + launchFee.amount;
                
                totalAffiliateGmv += affiliateGmv;
                totalMarketingGmv += marketingGmv;
                totalGmv += gmv;
                totalCommission += commission;
                totalRetainers += retainer;
                totalLaunchFees += launchFee.amount;
                
                return { brand, affiliateGmv, marketingGmv, gmv, rate: rates[brand] || 2, effectiveRate, commission, retainer, launchFee, total, tyler: total / 2, matt: total / 2 };
            });
            
            const totalEarnings = totalCommission + totalRetainers + totalLaunchFees;
            
            // Update summary displays
            document.getElementById('revTotalGmv').textContent = fmtMoney(totalGmv);
            document.getElementById('revTotalShare').textContent = fmtMoney(totalCommission);
            document.getElementById('revTotalRetainers').textContent = fmtMoney(totalRetainers);
            document.getElementById('revTotalLaunchFees').textContent = fmtMoney(totalLaunchFees);
            document.getElementById('revTotalEarnings').textContent = fmtMoney(totalEarnings);
            document.getElementById('revTylerShare').textContent = fmtMoney(totalEarnings / 2);
            document.getElementById('revMattShare').textContent = fmtMoney(totalEarnings / 2);
            
            // Update goal tracker
            updateGoalUI(totalEarnings);
            
            // Update brand table
            const tbody = document.getElementById('revShareBody');
            tbody.innerHTML = brandRows.map(row => {
                const launchFeeDisplay = row.launchFee.isActive 
                    ? `<div style="font-size: 0.75rem; color: var(--info);">
                         ${row.launchFee.name || 'Launch Fee'}
                         <br><span style="color: var(--text-muted);">ends ${row.launchFee.ends || 'TBD'}</span>
                       </div>`
                    : '';
                
                return `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div style="width: 32px; height: 32px; border-radius: 8px; background: var(--accent-dim); display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
                                ${BRAND_ICONS[row.brand] || '🏷️'}
                            </div>
                            <span style="font-weight: 600;">${BRAND_DISPLAY[row.brand] || row.brand}</span>
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 500; color: var(--accent);">${fmtMoney(row.affiliateGmv)}</td>
                    <td style="text-align: right;">
                        $<input type="number" 
                            value="${row.marketingGmv}" 
                            min="0" max="10000000" step="100" 
                            style="width: 90px; text-align: right; background: var(--bg-secondary); border: 1px solid var(--purple); border-radius: 6px; padding: 4px 8px; color: var(--purple); font-weight: 600;"
                            onchange="updateMarketingGmv('${row.brand}', this.value)"
                            title="Marketing account GMV (manual entry)"
                        >
                    </td>
                    <td style="text-align: right; font-weight: 600; color: var(--accent);">${fmtMoney(row.gmv)}</td>
                    <td style="text-align: center;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                            <div style="display: flex; align-items: center; gap: 2px;">
                                <input type="number" 
                                    value="${row.rate}" 
                                    min="0" max="10" step="0.5" 
                                    style="width: 50px; text-align: center; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 6px; padding: 4px 6px; color: var(--text-primary); font-weight: 600; font-size: 0.85rem;"
                                    onchange="updateBrandRate('${row.brand}', this.value)"
                                    title="Base brand rate"
                                >%
                            </div>
                            ${Math.abs(row.effectiveRate - row.rate) > 0.01 ? `
                                <div style="font-size: 0.7rem; color: var(--accent);" title="Effective rate after custom creator rates">
                                    eff: ${row.effectiveRate.toFixed(2)}%
                                </div>
                            ` : ''}
                        </div>
                    </td>
                    <td style="text-align: right; color: var(--success);">${fmtMoney(row.commission)}</td>
                    <td style="text-align: center;">
                        $<input type="number" 
                            value="${row.retainer}" 
                            min="0" max="100000" step="100" 
                            style="width: 80px; text-align: center; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 6px; padding: 4px 8px; color: var(--text-primary); font-weight: 600;"
                            onchange="updateBrandRetainer('${row.brand}', this.value)"
                        >
                    </td>
                    <td style="text-align: center;">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">
                            <div style="display: flex; align-items: center; gap: 4px;">
                                $<input type="number" 
                                    value="${row.launchFee.amount}" 
                                    min="0" max="100000" step="100" 
                                    style="width: 80px; text-align: center; background: var(--bg-secondary); border: 1px solid ${row.launchFee.isActive ? 'var(--info)' : 'var(--border-light)'}; border-radius: 6px; padding: 4px 8px; color: ${row.launchFee.isActive ? 'var(--info)' : 'var(--text-primary)'}; font-weight: 600;"
                                    onchange="openLaunchFeeModal('${row.brand}', this.value)"
                                    title="Click to set launch fee details"
                                >
                            </div>
                            ${launchFeeDisplay}
                        </div>
                    </td>
                    <td style="text-align: right; font-weight: 600; color: var(--success);">${fmtMoney(row.total)}</td>
                    <td style="text-align: right; color: var(--blue);">${fmtMoney(row.tyler)}</td>
                    <td style="text-align: right; color: var(--purple);">${fmtMoney(row.matt)}</td>
                </tr>
            `}).join('');
            
            // Update footer
            document.getElementById('footerAffiliateGmv').textContent = fmtMoney(totalAffiliateGmv);
            document.getElementById('footerMarketingGmv').textContent = fmtMoney(totalMarketingGmv);
            document.getElementById('footerGmv').textContent = fmtMoney(totalGmv);
            document.getElementById('footerCommission').textContent = fmtMoney(totalCommission);
            document.getElementById('footerRetainer').textContent = fmtMoney(totalRetainers);
            document.getElementById('footerLaunchFee').textContent = fmtMoney(totalLaunchFees);
            document.getElementById('footerTotal').textContent = fmtMoney(totalEarnings);
            document.getElementById('footerTyler').textContent = fmtMoney(totalEarnings / 2);
            document.getElementById('footerMatt').textContent = fmtMoney(totalEarnings / 2);
            
            // Update cached data
            cachedEarningsData.brandRows = brandRows;
            cachedEarningsData.totalCommission = totalCommission;
            cachedEarningsData.totalEarnings = totalEarnings;
            cachedEarningsData.tylerTotal = totalEarnings / 2;
            cachedEarningsData.mattTotal = totalEarnings / 2;
        }
        
        function openCreatorRateModal(brand, creatorName, currentRate) {
            const brandRate = (getRevShareRates()[brand] || 2) / 100;
            const isCustom = currentRate !== brandRate;
            
            const modalHtml = `
                <div id="creatorRateModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;" onclick="if(event.target.id==='creatorRateModal')this.remove()">
                    <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; max-width: 400px; width: 90%;">
                        <h3 style="margin-bottom: 16px; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">💰</span>
                            Commission Rate
                        </h3>
                        <p style="color: var(--text-muted); margin-bottom: 20px; font-size: 0.9rem;">
                            <strong>${creatorName}</strong> • ${BRAND_DISPLAY[brand] || brand}
                        </p>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
                                Commission Rate (Brand default: ${(brandRate * 100).toFixed(1)}%)
                            </label>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <input type="number" id="creatorRateInput" value="${(currentRate * 100).toFixed(1)}" 
                                    min="0" max="10" step="0.5"
                                    style="flex: 1; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 1.1rem; font-weight: 600;">
                                <span style="color: var(--text-muted); font-size: 1.1rem;">%</span>
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 12px;">
                            <button class="btn btn-secondary" style="flex: 1;" onclick="setCreatorRate('${brand}', '${creatorName}', ${brandRate}); document.getElementById('creatorRateModal').remove();">
                                Reset to Default
                            </button>
                            <button class="btn btn-primary" style="flex: 1;" onclick="setCreatorRate('${brand}', '${creatorName}', parseFloat(document.getElementById('creatorRateInput').value) / 100); document.getElementById('creatorRateModal').remove();">
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            document.getElementById('creatorRateInput').focus();
        }
        
        function renderCreatorBreakdown() {
            const tbody = document.getElementById('creatorBreakdownBody');
            if (!tbody) return;
            
            const creatorGmvByBrand = cachedEarningsData?.creatorGmvByBrand;
            if (!creatorGmvByBrand) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">Calculate earnings to see creator breakdown</td></tr>';
                return;
            }
            
            // Get filter
            const selectedBrand = document.getElementById('creatorBreakdownBrand')?.value || 'all';
            
            // Flatten all creators
            let allCreators = [];
            for (const [brand, creators] of Object.entries(creatorGmvByBrand)) {
                if (selectedBrand !== 'all' && brand !== selectedBrand) continue;
                
                for (const creator of Object.values(creators)) {
                    const rate = getCreatorRate(brand, creator.creator_name);
                    const brandRate = (getRevShareRates()[brand] || 2) / 100;
                    const isCustomRate = rate !== brandRate;
                    
                    allCreators.push({
                        ...creator,
                        rate,
                        isCustomRate,
                        commission: creator.gmv * rate
                    });
                }
            }
            
            // Sort by GMV descending
            allCreators.sort((a, b) => b.gmv - a.gmv);
            
            // Calculate totals
            const totalGmv = allCreators.reduce((s, c) => s + c.gmv, 0);
            const totalCommission = allCreators.reduce((s, c) => s + c.commission, 0);
            const customCount = allCreators.filter(c => c.isCustomRate).length;
            
            // Calculate weighted average rate
            const avgRate = totalGmv > 0 ? (totalCommission / totalGmv) : 0.02;
            
            // Update summary
            document.getElementById('cbCreatorCount').textContent = allCreators.length;
            document.getElementById('cbTotalGmv').textContent = fmtMoney(totalGmv);
            document.getElementById('cbAvgRate').textContent = (avgRate * 100).toFixed(1) + '%';
            document.getElementById('cbTotalCommission').textContent = fmtMoney(totalCommission);
            
            // Show/hide custom rate notice
            const noticeEl = document.getElementById('customRateNotice');
            if (noticeEl) {
                noticeEl.style.display = customCount > 0 ? 'block' : 'none';
                document.getElementById('customRateCount').textContent = customCount;
            }
            
            if (allCreators.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No creators found for this period</td></tr>';
                return;
            }
            
            // Render table
            tbody.innerHTML = allCreators.map((c, i) => {
                const pctOfTotal = totalGmv > 0 ? ((c.gmv / totalGmv) * 100).toFixed(1) : '0.0';
                const rateClass = c.isCustomRate ? 'custom' : 'standard';
                const rateDisplay = (c.rate * 100).toFixed(1);
                
                return `
                    <tr>
                        <td style="color: ${i < 3 ? 'var(--accent)' : 'var(--text-muted)'}; font-weight: 600;">${i + 1}</td>
                        <td>
                            <div style="font-weight: 500;">${c.creator_name}</div>
                        </td>
                        <td>
                            <span style="display: inline-flex; align-items: center; gap: 6px;">
                                <span style="font-size: 0.9rem;">${BRAND_ICONS[c.brand] || '🏷️'}</span>
                                <span style="font-size: 0.85rem; color: var(--text-secondary);">${BRAND_DISPLAY[c.brand] || c.brand}</span>
                            </span>
                        </td>
                        <td style="text-align: right; font-weight: 600; color: var(--accent);">${fmtMoney(c.gmv)}</td>
                        <td style="text-align: right;">${c.orders.toLocaleString()}</td>
                        <td style="text-align: center;">
                            <span class="rate-badge ${rateClass}" 
                                onclick="openCreatorRateModal('${c.brand}', '${c.creator_name.replace(/'/g, "\\'")}', ${c.rate})"
                                title="Click to edit rate">
                                ${rateDisplay}%
                            </span>
                        </td>
                        <td style="text-align: right; color: var(--success); font-weight: 500;">${fmtMoney(c.commission)}</td>
                        <td style="text-align: right; color: var(--text-muted);">${pctOfTotal}%</td>
                    </tr>
                `;
            }).join('');
        }
        
        function exportCreatorBreakdownCSV() {
            const creatorGmvByBrand = cachedEarningsData?.creatorGmvByBrand;
            if (!creatorGmvByBrand) {
                showToast('No data to export. Calculate earnings first.', 'error');
                return;
            }
            
            const selectedBrand = document.getElementById('creatorBreakdownBrand')?.value || 'all';
            const monthValue = document.getElementById('revShareMonth')?.value || 'unknown';
            
            // Flatten all creators
            let allCreators = [];
            for (const [brand, creators] of Object.entries(creatorGmvByBrand)) {
                if (selectedBrand !== 'all' && brand !== selectedBrand) continue;
                
                for (const creator of Object.values(creators)) {
                    const rate = getCreatorRate(brand, creator.creator_name);
                    allCreators.push({
                        creator_name: creator.creator_name,
                        brand: BRAND_DISPLAY[brand] || brand,
                        gmv: creator.gmv,
                        orders: creator.orders,
                        rate_percent: (rate * 100).toFixed(1),
                        commission: creator.gmv * rate
                    });
                }
            }
            
            // Sort by GMV
            allCreators.sort((a, b) => b.gmv - a.gmv);
            
            // Build CSV
            const headers = ['Creator', 'Brand', 'GMV', 'Orders', 'Rate %', 'Commission'];
            const rows = allCreators.map(c => [
                c.creator_name,
                c.brand,
                c.gmv.toFixed(2),
                c.orders,
                c.rate_percent,
                c.commission.toFixed(2)
            ]);
            
            // Add totals row
            const totalGmv = allCreators.reduce((s, c) => s + c.gmv, 0);
            const totalCommission = allCreators.reduce((s, c) => s + c.commission, 0);
            rows.push(['TOTAL', '', totalGmv.toFixed(2), '', '', totalCommission.toFixed(2)]);
            
            const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `creator-breakdown-${selectedBrand === 'all' ? 'all-brands' : selectedBrand}-${monthValue}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            showToast('Creator breakdown exported!', 'success');
        }
        
        async function updateBrandRate(brand, value) {
            const rate = parseFloat(value) || 2.5;
            await saveRevShareRate(brand, rate);
            calculateRevenueShare();
            showToast(`${BRAND_DISPLAY[brand]} commission rate updated to ${rate}%`, 'success');
        }
        
        async function updateBrandRetainer(brand, value) {
            const retainer = parseFloat(value) || 0;
            await saveRetainer(brand, retainer);
            calculateRevenueShare();
            showToast(`${BRAND_DISPLAY[brand]} retainer updated to ${fmtMoney(retainer)}`, 'success');
        }
        
        // Launch Fee Modal
        function openLaunchFeeModal(brand, currentAmount) {
            const launchFee = brandSettingsCache?.launchFees?.[brand] || { amount: 0, name: '', ends: '' };
            const amount = currentAmount !== undefined ? currentAmount : launchFee.amount;
            
            const modalHtml = `
                <div id="launchFeeModal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                    <div style="background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; max-width: 400px; width: 90%;">
                        <h3 style="margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.5rem;">🚀</span>
                            Launch Fee - ${BRAND_DISPLAY[brand] || brand}
                        </h3>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">Launch/Product Name</label>
                            <input type="text" id="launchFeeName" value="${launchFee.name || ''}" 
                                placeholder="e.g., Fiber Gummies Launch"
                                style="width: 100%; padding: 10px 12px; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 8px; color: var(--text-primary); font-size: 0.95rem;">
                        </div>
                        
                        <div style="margin-bottom: 16px;">
                            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">Launch Fee Amount</label>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="color: var(--text-muted);">$</span>
                                <input type="number" id="launchFeeAmount" value="${amount}" min="0" max="100000" step="100"
                                    style="flex: 1; padding: 10px 12px; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 8px; color: var(--text-primary); font-size: 0.95rem;">
                            </div>
                        </div>
                        
                        <div style="margin-bottom: 24px;">
                            <label style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-bottom: 6px;">Fee Ends (Leave blank for ongoing)</label>
                            <input type="date" id="launchFeeEnds" value="${launchFee.ends || ''}"
                                style="width: 100%; padding: 10px 12px; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 8px; color: var(--text-primary); font-size: 0.95rem;">
                        </div>
                        
                        <div style="display: flex; gap: 12px;">
                            <button onclick="closeLaunchFeeModal()" 
                                style="flex: 1; padding: 12px; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); font-weight: 600; cursor: pointer;">
                                Cancel
                            </button>
                            <button onclick="saveLaunchFee('${brand}')" 
                                style="flex: 1; padding: 12px; background: var(--info); border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer;">
                                Save Launch Fee
                            </button>
                        </div>
                        
                        ${launchFee.amount > 0 ? `
                        <button onclick="clearLaunchFee('${brand}')" 
                            style="width: 100%; margin-top: 12px; padding: 10px; background: transparent; border: 1px solid var(--danger); border-radius: 8px; color: var(--danger); font-weight: 500; cursor: pointer; font-size: 0.85rem;">
                            Remove Launch Fee
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }
        
        function closeLaunchFeeModal() {
            document.getElementById('launchFeeModal')?.remove();
        }
        
        async function saveLaunchFee(brand) {
            const name = document.getElementById('launchFeeName')?.value || '';
            const amount = parseFloat(document.getElementById('launchFeeAmount')?.value) || 0;
            const ends = document.getElementById('launchFeeEnds')?.value || null;
            
            try {
                const { error } = await supabaseClient
                    .from('brand_settings')
                    .update({ 
                        launch_fee: amount, 
                        launch_fee_name: name || null,
                        launch_fee_ends: ends,
                        updated_at: new Date().toISOString() 
                    })
                    .eq('brand', brand);
                
                if (error) throw error;
                
                // Update cache
                if (brandSettingsCache) {
                    brandSettingsCache.launchFees[brand] = {
                        amount: amount,
                        name: name,
                        ends: ends,
                        isActive: amount > 0
                    };
                }
                
                closeLaunchFeeModal();
                calculateRevenueShare();
                showToast(`${BRAND_DISPLAY[brand]} launch fee updated`, 'success');
            } catch (err) {
                console.error('Failed to save launch fee:', err);
                showToast('Failed to save: ' + err.message, 'error');
            }
        }
        
        async function clearLaunchFee(brand) {
            try {
                const { error } = await supabaseClient
                    .from('brand_settings')
                    .update({ 
                        launch_fee: 0, 
                        launch_fee_name: null,
                        launch_fee_ends: null,
                        updated_at: new Date().toISOString() 
                    })
                    .eq('brand', brand);
                
                if (error) throw error;
                
                // Update cache
                if (brandSettingsCache) {
                    brandSettingsCache.launchFees[brand] = {
                        amount: 0,
                        name: '',
                        ends: '',
                        isActive: false
                    };
                }
                
                closeLaunchFeeModal();
                calculateRevenueShare();
                showToast(`${BRAND_DISPLAY[brand]} launch fee removed`, 'success');
            } catch (err) {
                console.error('Failed to clear launch fee:', err);
                showToast('Failed to clear: ' + err.message, 'error');
            }
        }
        
        // Marketing GMV storage (per month, per brand) - stays in localStorage since it's per-month data
        function getMarketingGmv(monthKey) {
            try {
                const all = JSON.parse(localStorage.getItem('marketing_gmv') || '{}');
                return all[monthKey] || {};
            } catch {
                return {};
            }
        }
        
        function saveMarketingGmv(monthKey, brand, amount) {
            try {
                const all = JSON.parse(localStorage.getItem('marketing_gmv') || '{}');
                if (!all[monthKey]) all[monthKey] = {};
                all[monthKey][brand] = amount;
                localStorage.setItem('marketing_gmv', JSON.stringify(all));
            } catch (e) {
                console.error('Failed to save marketing GMV:', e);
            }
        }
        
        function updateMarketingGmv(brand, value) {
            const monthKey = document.getElementById('revShareMonth')?.value;
            if (!monthKey) return;
            const amount = parseFloat(value) || 0;
            saveMarketingGmv(monthKey, brand, amount);
            calculateRevenueShare();
            showToast(`${BRAND_DISPLAY[brand]} marketing GMV updated to ${fmtMoney(amount)}`, 'success');
        }
        
        // Goal tracker - uses monthly total earnings from calculateRevenueShare
        const REVENUE_GOAL = 100000;
        
        function updateGoalUI(currentAmount) {
            const percent = Math.min((currentAmount / REVENUE_GOAL) * 100, 100);
            const remaining = Math.max(REVENUE_GOAL - currentAmount, 0);
            
            document.getElementById('goalCurrentAmount').textContent = fmtMoney(currentAmount);
            document.getElementById('goalPercentText').textContent = `${percent.toFixed(1)}% complete`;
            document.getElementById('goalProgressBar').style.width = `${percent}%`;
            
            if (remaining > 0) {
                document.getElementById('goalProgressText').textContent = `${fmtMoney(remaining)} to go`;
            } else {
                document.getElementById('goalProgressText').textContent = '🎉 Goal reached!';
                document.getElementById('goalProgressBar').style.background = 'linear-gradient(90deg, #fbbf24, #f59e0b)';
            }
        }
        
        // Brand icons for display
        const BRAND_ICONS = {
            'catakor': '🐱',
            'jiyu': '✨',
            'physicians_choice': '💊',
            'peach_slices': '🍑',
            'yerba_magic': '🧉'
        };

        // ==================== CLIENT REPORT GENERATION ====================
        // Brand logo paths (local files in /logos folder)
        const BRAND_LOGOS = {
            'catakor': 'logos/catakor.png',
            'jiyu': 'logos/jiyu.png',
            'physicians_choice': 'logos/physicians_choice.png',
            'peach_slices': 'logos/peach_slices.png',
            'yerba_magic': 'logos/yerba_magic.png'
        };
        
        // Store uploaded brand logo as base64
        let uploadedBrandLogo = null;
        let clientReportPicker = null;
        
        function handleBrandLogoUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                uploadedBrandLogo = e.target.result;
                const img = document.getElementById('brandLogoImg');
                const placeholder = document.getElementById('brandLogoPlaceholder');
                img.src = uploadedBrandLogo;
                img.style.display = 'block';
                placeholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
        
        function clearBrandLogo() {
            uploadedBrandLogo = null;
            const img = document.getElementById('brandLogoImg');
            const placeholder = document.getElementById('brandLogoPlaceholder');
            img.src = '';
            img.style.display = 'none';
            placeholder.style.display = 'block';
            document.getElementById('brandLogoUpload').value = '';
        }
        
        function openClientReportModal() {
            document.getElementById('clientReportModal').classList.add('show');
            document.getElementById('clientReportPreviewContainer').style.display = 'none';
            
            // Initialize Litepicker for date range
            const el = document.getElementById('clientReportDateRange');
            const startHidden = document.getElementById('clientReportStartDate');
            const endHidden = document.getElementById('clientReportEndDate');
            
            if (!clientReportPicker && el) {
                const today = new Date();
                const thirtyDaysAgo = new Date(today);
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                clientReportPicker = new Litepicker({
                    element: el,
                    singleMode: false,
                    numberOfMonths: 2,
                    numberOfColumns: 2,
                    firstDay: 0,
                    startDate: thirtyDaysAgo,
                    endDate: yesterday,
                    format: 'MMM D, YYYY',
                    delimiter: ' → ',
                    autoApply: true,
                    showTooltip: true,
                    tooltipText: { one: 'day', other: 'days' },
                    setup: (picker) => {
                        picker.on('selected', (date1, date2) => {
                            if (date1 && date2) {
                                startHidden.value = date1.format('YYYY-MM-DD');
                                endHidden.value = date2.format('YYYY-MM-DD');
                                // Set to custom when manually selecting dates
                                document.getElementById('clientReportPeriod').value = 'custom';
                            }
                        });
                    }
                });
                
                // Set initial hidden values
                startHidden.value = localDateStr(thirtyDaysAgo);
                endHidden.value = localDateStr(yesterday);
            }
            
            // Apply default preset (Last 30 Days)
            handleReportPeriodChange();
            
            // Auto-load brand logo
            updateReportBrandLogo();
        }
        
        function handleReportPeriodChange() {
            const period = document.getElementById('clientReportPeriod').value;
            if (period === 'custom' || !clientReportPicker) return;
            
            const today = new Date();
            let startDate, endDate;
            
            switch (period) {
                case 'last7':
                    endDate = new Date(today);
                    endDate.setDate(endDate.getDate() - 1);
                    startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 6);
                    break;
                case 'last14':
                    endDate = new Date(today);
                    endDate.setDate(endDate.getDate() - 1);
                    startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 13);
                    break;
                case 'last30':
                    endDate = new Date(today);
                    endDate.setDate(endDate.getDate() - 1);
                    startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 29);
                    break;
                case 'mtd':
                    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                    endDate = new Date(today);
                    endDate.setDate(endDate.getDate() - 1);
                    break;
                case 'lastmonth':
                    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    endDate = new Date(today.getFullYear(), today.getMonth(), 0);
                    break;
            }
            
            if (startDate && endDate) {
                clientReportPicker.setDateRange(startDate, endDate);
                document.getElementById('clientReportStartDate').value = localDateStr(startDate);
                document.getElementById('clientReportEndDate').value = localDateStr(endDate);
            }
        }
        
        function toggleCustomDateRange() {
            // Deprecated - using Litepicker now
        }
        
        function updateReportBrandLogo() {
            const brand = document.getElementById('clientReportBrand').value;
            const logoPath = BRAND_LOGOS[brand];
            const img = document.getElementById('brandLogoImg');
            const placeholder = document.getElementById('brandLogoPlaceholder');
            
            if (logoPath) {
                // Load the stored logo
                img.src = logoPath;
                img.style.display = 'block';
                placeholder.style.display = 'none';
                
                // Also convert to base64 for PDF embedding
                fetch(logoPath)
                    .then(res => res.blob())
                    .then(blob => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            uploadedBrandLogo = reader.result;
                        };
                        reader.readAsDataURL(blob);
                    })
                    .catch(() => {
                        // If fetch fails, just show the image directly
                        uploadedBrandLogo = null;
                    });
            } else {
                img.style.display = 'none';
                placeholder.style.display = 'inline';
                placeholder.textContent = 'No logo available';
                uploadedBrandLogo = null;
            }
        }
        
        function closeClientReportModal() {
            document.getElementById('clientReportModal').classList.remove('show');
        }
        
        function getReportDateRange(period) {
            // Always use the hidden date inputs set by Litepicker
            const startStr = document.getElementById('clientReportStartDate').value;
            const endStr = document.getElementById('clientReportEndDate').value;
            
            const startDate = new Date(startStr + 'T00:00:00');
            const endDate = new Date(endStr + 'T00:00:00');
            
            return {
                start: startStr,
                end: endStr,
                display: `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            };
        }
        
        async function fetchClientReportData(brand, dateRange) {
            // Calculate prior period for WoW comparison
            const startDate = new Date(dateRange.start + 'T00:00:00');
            const endDate = new Date(dateRange.end + 'T00:00:00');
            const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
            const priorEnd = new Date(startDate);
            priorEnd.setDate(priorEnd.getDate() - 1);
            const priorStart = new Date(priorEnd);
            priorStart.setDate(priorStart.getDate() - daysDiff + 1);
            const priorStartStr = localDateStr(priorStart);
            const priorEndStr = localDateStr(priorEnd);
            
            // Fetch current period creator performance with pagination
            let allPerfData = [];
            let page = 0;
            let hasMore = true;
            while (hasMore && page < MAX_PAGES) {
                const { data } = await supabaseClient
                    .from('creator_performance')
                    .select('creator_name, gmv, orders, videos, report_date, items_sold, est_commission')
                    .eq('brand', brand)
                    .eq('period_type', 'daily')
                    .gte('report_date', dateRange.start)
                    .lte('report_date', dateRange.end)
                    .range(page * QUERY_PAGE_SIZE, (page + 1) * QUERY_PAGE_SIZE - 1);
                if (!data || data.length === 0) hasMore = false;
                else {
                    allPerfData = allPerfData.concat(data);
                    hasMore = data.length === QUERY_PAGE_SIZE;
                    page++;
                }
            }
            
            // Fetch prior period for comparison
            let priorPerfData = [];
            page = 0;
            hasMore = true;
            while (hasMore && page < MAX_PAGES) {
                const { data } = await supabaseClient
                    .from('creator_performance')
                    .select('creator_name, gmv, orders, videos')
                    .eq('brand', brand)
                    .eq('period_type', 'daily')
                    .gte('report_date', priorStartStr)
                    .lte('report_date', priorEndStr)
                    .range(page * QUERY_PAGE_SIZE, (page + 1) * QUERY_PAGE_SIZE - 1);
                if (!data || data.length === 0) hasMore = false;
                else {
                    priorPerfData = priorPerfData.concat(data);
                    hasMore = data.length === QUERY_PAGE_SIZE;
                    page++;
                }
            }
            
            // Build daily breakdown
            const dailyMap = new Map();
            allPerfData.forEach(row => {
                const date = row.report_date;
                if (!dailyMap.has(date)) {
                    dailyMap.set(date, { date, gmv: 0, orders: 0, videos: 0, creators: new Set() });
                }
                const d = dailyMap.get(date);
                d.gmv += pFloat(row.gmv);
                d.orders += pInt(row.orders);
                d.videos += pInt(row.videos);
                d.creators.add(row.creator_name);
            });
            const dailyBreakdown = [...dailyMap.values()]
                .map(d => ({ ...d, creators: d.creators.size }))
                .sort((a, b) => a.date.localeCompare(b.date));
            
            // Build day of week breakdown
            const dayOfWeekMap = { 0: { day: 'Sun', gmv: 0, orders: 0 }, 1: { day: 'Mon', gmv: 0, orders: 0 }, 2: { day: 'Tue', gmv: 0, orders: 0 }, 3: { day: 'Wed', gmv: 0, orders: 0 }, 4: { day: 'Thu', gmv: 0, orders: 0 }, 5: { day: 'Fri', gmv: 0, orders: 0 }, 6: { day: 'Sat', gmv: 0, orders: 0 } };
            dailyBreakdown.forEach(d => {
                const dayNum = new Date(d.date + 'T00:00:00').getDay();
                dayOfWeekMap[dayNum].gmv += d.gmv;
                dayOfWeekMap[dayNum].orders += d.orders;
            });
            const dayOfWeekBreakdown = Object.values(dayOfWeekMap);
            
            // Aggregate by creator
            const creatorMap = new Map();
            allPerfData.forEach(row => {
                if (!creatorMap.has(row.creator_name)) {
                    creatorMap.set(row.creator_name, { creator_name: row.creator_name, gmv: 0, orders: 0, videos: 0, items_sold: 0, est_commission: 0 });
                }
                const c = creatorMap.get(row.creator_name);
                c.gmv += pFloat(row.gmv);
                c.orders += pInt(row.orders);
                c.videos += pInt(row.videos);
                c.items_sold += pInt(row.items_sold);
                c.est_commission += pFloat(row.est_commission);
            });
            const creators = [...creatorMap.values()].sort((a, b) => b.gmv - a.gmv);
            
            // Calculate prior period totals and track prior creators
            const priorTotals = { gmv: 0, orders: 0, videos: 0, creators: new Set() };
            priorPerfData.forEach(row => {
                priorTotals.gmv += pFloat(row.gmv);
                priorTotals.orders += pInt(row.orders);
                priorTotals.videos += pInt(row.videos);
                priorTotals.creators.add(row.creator_name.toLowerCase());
            });
            
            // Calculate new vs returning creators
            const currentCreatorNames = new Set(creators.map(c => c.creator_name.toLowerCase()));
            let newCreators = 0, returningCreators = 0;
            let newCreatorsGmv = 0, returningCreatorsGmv = 0;
            creators.forEach(c => {
                const isReturning = priorTotals.creators.has(c.creator_name.toLowerCase());
                if (isReturning) {
                    returningCreators++;
                    returningCreatorsGmv += c.gmv;
                } else {
                    newCreators++;
                    newCreatorsGmv += c.gmv;
                }
            });
            
            // Fetch video performance with pagination
            let allVideoData = [];
            page = 0;
            hasMore = true;
            while (hasMore && page < MAX_PAGES) {
                const { data } = await supabaseClient
                    .from('video_performance')
                    .select('video_id, video_title, video_link, creator_name, gmv, orders')
                    .eq('brand', brand)
                    .gte('report_date', dateRange.start)
                    .lte('report_date', dateRange.end)
                    .range(page * QUERY_PAGE_SIZE, (page + 1) * QUERY_PAGE_SIZE - 1);
                if (!data || data.length === 0) hasMore = false;
                else {
                    allVideoData = allVideoData.concat(data);
                    hasMore = data.length === QUERY_PAGE_SIZE;
                    page++;
                }
            }
            
            // Aggregate by video
            const videoMap = new Map();
            allVideoData.forEach(row => {
                if (!videoMap.has(row.video_id)) {
                    videoMap.set(row.video_id, { 
                        video_id: row.video_id, 
                        video_title: row.video_title,
                        video_link: row.video_link,
                        creator_name: row.creator_name, 
                        gmv: 0, 
                        orders: 0 
                    });
                }
                const v = videoMap.get(row.video_id);
                v.gmv += pFloat(row.gmv);
                v.orders += pInt(row.orders);
            });
            const videos = [...videoMap.values()].sort((a, b) => b.gmv - a.gmv);
            
            // Fetch product performance
            const productMap = new Map();
            allVideoData.forEach(row => {
                if (!row.product_name) return;
                if (!productMap.has(row.product_name)) {
                    productMap.set(row.product_name, { product_name: row.product_name, gmv: 0, orders: 0 });
                }
                const p = productMap.get(row.product_name);
                p.gmv += pFloat(row.gmv);
                p.orders += pInt(row.orders);
            });
            const products = [...productMap.values()].sort((a, b) => b.gmv - a.gmv);
            
            // Calculate totals
            const totalGmv = creators.reduce((s, c) => s + c.gmv, 0);
            const totalOrders = creators.reduce((s, c) => s + c.orders, 0);
            const totalVideos = creators.reduce((s, c) => s + c.videos, 0);
            const totalCommission = creators.reduce((s, c) => s + c.est_commission, 0);
            
            // Calculate WoW changes
            const gmvChange = priorTotals.gmv > 0 ? ((totalGmv - priorTotals.gmv) / priorTotals.gmv * 100) : 0;
            const ordersChange = priorTotals.orders > 0 ? ((totalOrders - priorTotals.orders) / priorTotals.orders * 100) : 0;
            const videosChange = priorTotals.videos > 0 ? ((totalVideos - priorTotals.videos) / priorTotals.videos * 100) : 0;
            const creatorsChange = priorTotals.creators.size > 0 ? ((creators.length - priorTotals.creators.size) / priorTotals.creators.size * 100) : 0;
            
            // Fetch roster to determine managed status (check all account fields)
            const { data: rosterData } = await supabaseClient
                .from('managed_creators')
                .select('account_1, account_2, account_3, account_4, account_5')
                .eq('brand', brand);
            
            // Build set of all managed account names (lowercase)
            const managedSet = new Set();
            (rosterData || []).forEach(r => {
                [r.account_1, r.account_2, r.account_3, r.account_4, r.account_5].forEach(acct => {
                    if (acct) managedSet.add(acct.toLowerCase());
                });
            });
            
            // Calculate managed vs unmanaged breakdown
            let managedGmv = 0, unmanagedGmv = 0;
            let managedOrders = 0, unmanagedOrders = 0;
            let managedCreators = 0, unmanagedCreators = 0;
            let managedVideos = 0, unmanagedVideos = 0;
            
            creators.forEach(c => {
                const isManaged = managedSet.has(c.creator_name.toLowerCase());
                if (isManaged) {
                    managedGmv += c.gmv;
                    managedOrders += c.orders;
                    managedVideos += c.videos;
                    managedCreators++;
                } else {
                    unmanagedGmv += c.gmv;
                    unmanagedOrders += c.orders;
                    unmanagedVideos += c.videos;
                    unmanagedCreators++;
                }
            });
            
            return {
                totalGmv,
                totalOrders,
                totalVideos,
                totalCreators: creators.length,
                totalCommission,
                priorGmv: priorTotals.gmv,
                priorOrders: priorTotals.orders,
                priorVideos: priorTotals.videos,
                priorCreators: priorTotals.creators.size,
                gmvChange,
                ordersChange,
                videosChange,
                creatorsChange,
                dailyBreakdown,
                dayOfWeekBreakdown,
                creators: creators.slice(0, 10),
                allCreators: creators,
                videos: videos.slice(0, 10),
                topVideo: videos[0],
                products: products.slice(0, 5),
                avgOrderValue: totalOrders > 0 ? totalGmv / totalOrders : 0,
                avgGmvPerCreator: creators.length > 0 ? totalGmv / creators.length : 0,
                // Managed vs Unmanaged
                managedGmv,
                unmanagedGmv,
                managedOrders,
                unmanagedOrders,
                managedCreators,
                unmanagedCreators,
                managedVideos,
                unmanagedVideos,
                managedPct: totalGmv > 0 ? (managedGmv / totalGmv * 100) : 0,
                // New vs Returning
                newCreators,
                returningCreators,
                newCreatorsGmv,
                returningCreatorsGmv,
                newCreatorsPct: creators.length > 0 ? (newCreators / creators.length * 100) : 0
            };
        }
        
        async function previewClientReport() {
            const brand = document.getElementById('clientReportBrand').value;
            const period = document.getElementById('clientReportPeriod').value;
            const dateRange = getReportDateRange(period);
            
            document.getElementById('clientReportPreviewContainer').style.display = 'block';
            document.getElementById('clientReportPreview').innerHTML = '<p style="text-align: center; color: #666;">Loading data...</p>';
            
            try {
                const data = await fetchClientReportData(brand, dateRange);
                const html = generateClientReportHTML(brand, dateRange, data);
                document.getElementById('clientReportPreview').innerHTML = html;
            } catch (err) {
                document.getElementById('clientReportPreview').innerHTML = '<p style="text-align: center; color: #c00;">Error loading data</p>';
                console.error(err);
            }
        }
        
        function generateClientReportHTML(brand, dateRange, data) {
            const includeExecutiveSummary = document.getElementById('reportIncludeExecutiveSummary').checked;
            const includeSummary = document.getElementById('reportIncludeSummary').checked;
            const includeWoW = document.getElementById('reportIncludeWoW').checked;
            const includeDaily = document.getElementById('reportIncludeDaily').checked;
            const includeCreators = document.getElementById('reportIncludeCreators').checked;
            const includeVideos = document.getElementById('reportIncludeVideos').checked;
            const includeProducts = document.getElementById('reportIncludeProducts').checked;
            const includeManaged = document.getElementById('reportIncludeManaged').checked;
            const includeHighlights = document.getElementById('reportIncludeHighlights').checked;
            const includeNewReturning = document.getElementById('reportIncludeNewReturning').checked;
            const includeDayOfWeek = document.getElementById('reportIncludeDayOfWeek').checked;
            const includeBrandLogo = document.getElementById('reportIncludeBrandLogo').checked;
            const includeAgencyLogo = document.getElementById('reportIncludeAgencyLogo').checked;
            
            // Get logo - use uploaded base64 if available
            const brandLogoUrl = uploadedBrandLogo || '';
            const agencyLogoUrl = 'logo-dark.png';
            
            // Generate executive summary text
            const topCreator = data.creators[0];
            const topVideo = data.videos[0];
            const gmvTrend = data.gmvChange >= 0 ? 'up' : 'down';
            const gmvTrendText = data.gmvChange >= 0 ? 'increase' : 'decrease';
            const bestDay = data.dailyBreakdown.length > 0 ? data.dailyBreakdown.reduce((best, d) => d.gmv > best.gmv ? d : best, { gmv: 0, date: '' }) : { gmv: 0, date: '' };
            const maxDailyGmv = data.dailyBreakdown.length > 0 ? Math.max(...data.dailyBreakdown.map(d => d.gmv)) : 0;
            
            // Helper for change indicator
            const changeIndicator = (val, large = false) => {
                if (val === 0 || isNaN(val)) return '';
                const color = val >= 0 ? '#059669' : '#dc2626';
                const bgColor = val >= 0 ? 'rgba(5, 150, 105, 0.1)' : 'rgba(220, 38, 38, 0.1)';
                const arrow = val >= 0 ? '↑' : '↓';
                const size = large ? 'font-size: 16px; padding: 6px 12px;' : 'font-size: 12px; padding: 4px 8px;';
                return `<span style="display: inline-block; ${size} background: ${bgColor}; color: ${color}; font-weight: 600; border-radius: 20px;">${arrow} ${Math.abs(val).toFixed(1)}%</span>`;
            };
            
            // Medal for top 3
            const medal = (i) => {
                if (i === 0) return '<span style="font-size: 18px;">🥇</span>';
                if (i === 1) return '<span style="font-size: 18px;">🥈</span>';
                if (i === 2) return '<span style="font-size: 18px;">🥉</span>';
                return `<span style="display: inline-block; width: 24px; height: 24px; background: #e5e7eb; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600; color: #666;">${i + 1}</span>`;
            };
            
            // Build TikTok creator URL
            const creatorUrl = (name) => `https://www.tiktok.com/@${encodeURIComponent(name)}`;
            
            // Build video URL
            const videoUrl = (v) => {
                if (v.video_link && v.video_link.includes('tiktok.com')) return v.video_link;
                if (v.video_id && v.creator_name) return `https://www.tiktok.com/@${encodeURIComponent(v.creator_name)}/video/${v.video_id}`;
                return null;
            };
            
            // Progress bar helper
            const progressBar = (value, max, color = '#f5c518') => {
                const pct = max > 0 ? (value / max * 100) : 0;
                return `<div style="width: 100%; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
                    <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 3px;"></div>
                </div>`;
            };
            
            return `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 850px; margin: 0 auto; color: #1a1a1a;">
                    
                    <!-- ===== HEADER ===== -->
                    <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 32px; border-radius: 16px; margin-bottom: 24px;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
                            ${includeBrandLogo && brandLogoUrl ? `
                            <img src="${brandLogoUrl}" alt="${BRAND_DISPLAY[brand] || brand}" style="max-height: 50px; max-width: 160px; object-fit: contain;">
                            ` : `<div style="font-size: 24px; font-weight: 700;">${BRAND_DISPLAY[brand] || brand}</div>`}
                            ${includeAgencyLogo ? `
                            <div style="text-align: right;">
                                <div style="font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Powered by</div>
                                <img src="${agencyLogoUrl}" alt="Creators Corner" style="max-height: 32px; filter: invert(1) brightness(2);">
                            </div>
                            ` : ''}
                        </div>
                        <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
                            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,0.6); margin-bottom: 8px;">Performance Report</div>
                            <div style="font-size: 28px; font-weight: 700; margin-bottom: 4px;">${dateRange.display}</div>
                        </div>
                    </div>
                    
                    ${includeExecutiveSummary ? `
                    <!-- ===== EXECUTIVE SUMMARY ===== -->
                    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                            <span style="font-size: 20px;">📋</span>
                            <span style="font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #92400e;">Executive Summary</span>
                        </div>
                        <div style="color: #78350f; line-height: 1.8; font-size: 15px;">
                            This period, <strong>${BRAND_DISPLAY[brand] || brand}</strong> generated <strong style="color: #059669;">$${data.totalGmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong> in GMV 
                            from <strong>${data.totalOrders.toLocaleString()}</strong> orders across <strong>${data.totalCreators.toLocaleString()}</strong> active creators.
                            ${data.priorGmv > 0 ? `This represents a <strong style="color: ${data.gmvChange >= 0 ? '#059669' : '#dc2626'};">${Math.abs(data.gmvChange).toFixed(1)}% ${gmvTrendText}</strong> compared to the prior period.` : ''}
                            ${topCreator ? `<strong>@${topCreator.creator_name}</strong> led the pack with $${topCreator.gmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} in sales.` : ''}
                            ${bestDay.date ? `Peak performance occurred on <strong>${new Date(bestDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</strong> with $${bestDay.gmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} GMV.` : ''}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${includeHighlights ? `
                    <!-- ===== TOP 3 HIGHLIGHTS ===== -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                        <!-- Top Creator -->
                        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 20px; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 8px;">🏆</div>
                            <div style="font-size: 11px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Top Creator</div>
                            ${topCreator ? `
                            <div style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">@${topCreator.creator_name}</div>
                            <div style="font-size: 20px; font-weight: 800; color: #059669;">$${topCreator.gmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${topCreator.orders} orders • ${topCreator.videos} videos</div>
                            ` : '<div style="color: #6b7280;">No data</div>'}
                        </div>
                        
                        <!-- Top Video -->
                        <div style="background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 12px; padding: 20px; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 8px;">🎬</div>
                            <div style="font-size: 11px; color: #1e40af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Top Video</div>
                            ${data.topVideo ? `
                            <div style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(data.topVideo.video_title || 'Untitled').substring(0, 25)}${(data.topVideo.video_title || '').length > 25 ? '...' : ''}</div>
                            <div style="font-size: 20px; font-weight: 800; color: #059669;">$${data.topVideo.gmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">by @${data.topVideo.creator_name}</div>
                            ` : '<div style="color: #6b7280;">No data</div>'}
                        </div>
                        
                        <!-- Best Day -->
                        <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; padding: 20px; text-align: center;">
                            <div style="font-size: 32px; margin-bottom: 8px;">📅</div>
                            <div style="font-size: 11px; color: #065f46; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Best Day</div>
                            ${bestDay.date ? `
                            <div style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin-bottom: 4px;">${new Date(bestDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                            <div style="font-size: 20px; font-weight: 800; color: #059669;">$${bestDay.gmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                            <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">${bestDay.orders} orders</div>
                            ` : '<div style="color: #6b7280;">No data</div>'}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${includeSummary ? `
                    <!-- ===== HERO STAT ===== -->
                    <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 32px; border-radius: 16px; margin-bottom: 24px; text-align: center;">
                        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; opacity: 0.8; margin-bottom: 8px;">Total GMV</div>
                        <div style="font-size: 48px; font-weight: 800; letter-spacing: -1px; margin-bottom: 8px;">$${data.totalGmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                        ${includeWoW && data.priorGmv > 0 ? `
                        <div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                            ${data.gmvChange >= 0 ? '↑' : '↓'} ${Math.abs(data.gmvChange).toFixed(1)}% vs prior period
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- ===== KEY METRICS ===== -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
                        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="font-size: 32px; margin-bottom: 8px;">📦</div>
                            <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">${data.totalOrders.toLocaleString()}</div>
                            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">Orders</div>
                            ${includeWoW && data.priorOrders > 0 ? `<div style="margin-top: 8px;">${changeIndicator(data.ordersChange)}</div>` : ''}
                        </div>
                        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="font-size: 32px; margin-bottom: 8px;">👥</div>
                            <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">${data.totalCreators.toLocaleString()}</div>
                            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">Active Creators</div>
                            ${includeWoW && data.priorCreators > 0 ? `<div style="margin-top: 8px;">${changeIndicator(data.creatorsChange)}</div>` : ''}
                        </div>
                        <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                            <div style="font-size: 32px; margin-bottom: 8px;">🎬</div>
                            <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">${data.totalVideos.toLocaleString()}</div>
                            <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px;">Videos Posted</div>
                            ${includeWoW && data.priorVideos > 0 ? `<div style="margin-top: 8px;">${changeIndicator(data.videosChange)}</div>` : ''}
                        </div>
                    </div>
                    
                    <!-- ===== SECONDARY METRICS ===== -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px;">
                        <div style="background: #f9fafb; border-radius: 10px; padding: 16px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Avg Order Value</div>
                            <div style="font-size: 22px; font-weight: 700; color: #1a1a1a;">$${data.avgOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        <div style="background: #f9fafb; border-radius: 10px; padding: 16px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Avg GMV / Creator</div>
                            <div style="font-size: 22px; font-weight: 700; color: #1a1a1a;">$${data.avgGmvPerCreator.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                        </div>
                        <div style="background: #f9fafb; border-radius: 10px; padding: 16px; text-align: center;">
                            <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Est. Commission</div>
                            <div style="font-size: 22px; font-weight: 700; color: #1a1a1a;">$${data.totalCommission.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${includeManaged && (data.managedGmv > 0 || data.unmanagedGmv > 0) ? `
                    <!-- ===== MANAGED VS UNMANAGED ===== -->
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="font-size: 24px;">✅</span>
                            <span style="font-size: 18px; font-weight: 700;">Managed vs Unmanaged Performance</span>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 24px; align-items: center;">
                            <!-- Managed Side -->
                            <div style="text-align: center;">
                                <div style="font-size: 12px; font-weight: 600; color: #059669; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">✓ Managed</div>
                                <div style="font-size: 36px; font-weight: 800; color: #059669; margin-bottom: 8px;">$${data.managedGmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                <div style="display: flex; justify-content: center; gap: 16px; font-size: 13px; color: #6b7280;">
                                    <span><strong style="color: #1a1a1a;">${data.managedCreators}</strong> creators</span>
                                    <span><strong style="color: #1a1a1a;">${data.managedOrders.toLocaleString()}</strong> orders</span>
                                </div>
                            </div>
                            
                            <!-- Donut Chart Visual -->
                            <div style="position: relative; width: 140px; height: 140px;">
                                <svg viewBox="0 0 36 36" style="width: 140px; height: 140px; transform: rotate(-90deg);">
                                    <!-- Background circle -->
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" stroke-width="3"></circle>
                                    <!-- Managed portion (green) -->
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#059669" stroke-width="3" 
                                        stroke-dasharray="${data.managedPct} ${100 - data.managedPct}" stroke-linecap="round"></circle>
                                </svg>
                                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                                    <div style="font-size: 24px; font-weight: 800; color: #059669;">${data.managedPct.toFixed(0)}%</div>
                                    <div style="font-size: 10px; color: #6b7280; text-transform: uppercase;">Managed</div>
                                </div>
                            </div>
                            
                            <!-- Unmanaged Side -->
                            <div style="text-align: center;">
                                <div style="font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px;">Unmanaged</div>
                                <div style="font-size: 36px; font-weight: 800; color: #6b7280; margin-bottom: 8px;">$${data.unmanagedGmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                <div style="display: flex; justify-content: center; gap: 16px; font-size: 13px; color: #6b7280;">
                                    <span><strong style="color: #1a1a1a;">${data.unmanagedCreators}</strong> creators</span>
                                    <span><strong style="color: #1a1a1a;">${data.unmanagedOrders.toLocaleString()}</strong> orders</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Progress Bar -->
                        <div style="margin-top: 20px;">
                            <div style="height: 12px; background: #e5e7eb; border-radius: 6px; overflow: hidden; display: flex;">
                                <div style="width: ${data.managedPct}%; background: linear-gradient(90deg, #059669, #10b981); transition: width 0.3s;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px;">
                                <span style="color: #059669; font-weight: 600;">✓ ${data.managedPct.toFixed(1)}% Managed</span>
                                <span style="color: #6b7280;">${(100 - data.managedPct).toFixed(1)}% Unmanaged</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${includeNewReturning ? `
                    <!-- ===== NEW VS RETURNING CREATORS ===== -->
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="font-size: 24px;">🆕</span>
                            <span style="font-size: 18px; font-weight: 700;">New vs Returning Creators</span>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
                            <!-- New Creators -->
                            <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px; text-align: center;">
                                <div style="font-size: 12px; font-weight: 600; color: #059669; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🆕 New This Period</div>
                                <div style="font-size: 36px; font-weight: 800; color: #059669; margin-bottom: 4px;">${data.newCreators}</div>
                                <div style="font-size: 13px; color: #065f46;">creators (${data.newCreatorsPct.toFixed(0)}%)</div>
                                <div style="font-size: 18px; font-weight: 700; color: #059669; margin-top: 12px;">$${data.newCreatorsGmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                <div style="font-size: 11px; color: #6b7280;">GMV from new creators</div>
                            </div>
                            
                            <!-- Returning Creators -->
                            <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; padding: 20px; text-align: center;">
                                <div style="font-size: 12px; font-weight: 600; color: #2563eb; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">🔄 Returning</div>
                                <div style="font-size: 36px; font-weight: 800; color: #2563eb; margin-bottom: 4px;">${data.returningCreators}</div>
                                <div style="font-size: 13px; color: #1e40af;">creators (${(100 - data.newCreatorsPct).toFixed(0)}%)</div>
                                <div style="font-size: 18px; font-weight: 700; color: #2563eb; margin-top: 12px;">$${data.returningCreatorsGmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                <div style="font-size: 11px; color: #6b7280;">GMV from returning creators</div>
                            </div>
                        </div>
                        
                        <!-- Comparison Bar -->
                        <div style="margin-top: 16px;">
                            <div style="height: 10px; background: #dbeafe; border-radius: 5px; overflow: hidden; display: flex;">
                                <div style="width: ${data.newCreatorsPct}%; background: linear-gradient(90deg, #059669, #10b981);"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; margin-top: 6px; font-size: 11px; color: #6b7280;">
                                <span>New: ${data.newCreatorsPct.toFixed(1)}%</span>
                                <span>Returning: ${(100 - data.newCreatorsPct).toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${includeDayOfWeek && data.dayOfWeekBreakdown ? `
                    <!-- ===== DAY OF WEEK PERFORMANCE ===== -->
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="font-size: 24px;">📆</span>
                            <span style="font-size: 18px; font-weight: 700;">Performance by Day of Week</span>
                        </div>
                        
                        <div style="display: flex; gap: 8px; align-items: flex-end; height: 140px;">
                            ${(() => {
                                const maxDowGmv = Math.max(...data.dayOfWeekBreakdown.map(d => d.gmv));
                                return data.dayOfWeekBreakdown.map((d, i) => {
                                    const height = maxDowGmv > 0 ? (d.gmv / maxDowGmv * 100) : 0;
                                    const isMax = d.gmv === maxDowGmv && d.gmv > 0;
                                    const isWeekend = i === 0 || i === 6;
                                    return `
                                    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;">
                                        <div style="font-size: 11px; font-weight: 600; color: ${isMax ? '#059669' : '#6b7280'};">$${(d.gmv/1000).toFixed(1)}k</div>
                                        <div style="width: 100%; height: ${Math.max(height, 8)}%; background: ${isMax ? 'linear-gradient(180deg, #059669, #047857)' : isWeekend ? 'linear-gradient(180deg, #8b5cf6, #7c3aed)' : 'linear-gradient(180deg, #3b82f6, #2563eb)'}; border-radius: 6px 6px 0 0; min-height: 8px;"></div>
                                        <div style="font-size: 12px; font-weight: 600; color: ${isMax ? '#059669' : isWeekend ? '#7c3aed' : '#1a1a1a'};">${d.day}</div>
                                    </div>
                                    `;
                                }).join('');
                            })()}
                        </div>
                        
                        <div style="display: flex; justify-content: center; gap: 24px; margin-top: 16px; font-size: 12px;">
                            <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 12px; height: 12px; background: #3b82f6; border-radius: 3px;"></span> Weekday</span>
                            <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 12px; height: 12px; background: #8b5cf6; border-radius: 3px;"></span> Weekend</span>
                            <span style="display: flex; align-items: center; gap: 6px;"><span style="width: 12px; height: 12px; background: #059669; border-radius: 3px;"></span> Best Day</span>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${includeDaily && data.dailyBreakdown.length > 0 ? `
                    <!-- ===== DAILY BREAKDOWN ===== -->
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="font-size: 24px;">📊</span>
                            <span style="font-size: 18px; font-weight: 700;">Daily Performance</span>
                        </div>
                        
                        <!-- Visual Bar Chart -->
                        <div style="display: flex; align-items: flex-end; gap: 8px; height: 120px; margin-bottom: 24px; padding: 0 4px;">
                            ${data.dailyBreakdown.map((d, i) => {
                                const height = maxDailyGmv > 0 ? (d.gmv / maxDailyGmv * 100) : 0;
                                const isMax = d.gmv === maxDailyGmv;
                                const dayLabel = new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                                return `
                                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
                                    <div style="font-size: 10px; font-weight: 600; color: ${isMax ? '#059669' : '#6b7280'};">$${(d.gmv/1000).toFixed(1)}k</div>
                                    <div style="width: 100%; height: ${Math.max(height, 5)}%; background: ${isMax ? 'linear-gradient(180deg, #059669, #047857)' : 'linear-gradient(180deg, #f5c518, #eab308)'}; border-radius: 4px 4px 0 0; min-height: 4px;"></div>
                                    <div style="font-size: 10px; color: #6b7280; font-weight: 500;">${dayLabel}</div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                        
                        <!-- Data Table -->
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr style="border-bottom: 2px solid #e5e7eb;">
                                    <th style="text-align: left; padding: 12px 8px; font-weight: 600; color: #6b7280; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Date</th>
                                    <th style="text-align: right; padding: 12px 8px; font-weight: 600; color: #6b7280; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">GMV</th>
                                    <th style="text-align: right; padding: 12px 8px; font-weight: 600; color: #6b7280; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Orders</th>
                                    <th style="text-align: right; padding: 12px 8px; font-weight: 600; color: #6b7280; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">Creators</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.dailyBreakdown.map((d, i) => {
                                    const isMax = d.gmv === maxDailyGmv;
                                    return `
                                    <tr style="border-bottom: 1px solid #f3f4f6; ${isMax ? 'background: #f0fdf4;' : i % 2 === 0 ? 'background: #fafafa;' : ''}">
                                        <td style="padding: 12px 8px; font-weight: 500;">${new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${isMax ? '<span style="background: #059669; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 6px;">PEAK</span>' : ''}</td>
                                        <td style="text-align: right; padding: 12px 8px; font-weight: 600; color: #059669;">$${d.gmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                        <td style="text-align: right; padding: 12px 8px;">${d.orders.toLocaleString()}</td>
                                        <td style="text-align: right; padding: 12px 8px;">${d.creators.toLocaleString()}</td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}
                    
                    ${includeCreators && data.creators.length > 0 ? `
                    <!-- ===== TOP CREATORS ===== -->
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="font-size: 24px;">🏆</span>
                            <span style="font-size: 18px; font-weight: 700;">Top Performing Creators</span>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${data.creators.map((c, i) => {
                                const pctOfTotal = data.totalGmv > 0 ? (c.gmv / data.totalGmv * 100) : 0;
                                return `
                                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: ${i < 3 ? '#fffbeb' : '#f9fafb'}; border-radius: 10px; ${i < 3 ? 'border: 1px solid #fde68a;' : ''}">
                                    <div style="width: 36px; text-align: center;">${medal(i)}</div>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                            <a href="${creatorUrl(c.creator_name)}" target="_blank" style="font-weight: 600; color: #1a1a1a; text-decoration: none; font-size: 14px;">@${c.creator_name}</a>
                                            <span style="font-size: 11px; color: #6b7280;">${c.videos} videos</span>
                                        </div>
                                        ${progressBar(c.gmv, data.creators[0].gmv, i < 3 ? '#f5c518' : '#d1d5db')}
                                    </div>
                                    <div style="text-align: right; min-width: 100px;">
                                        <div style="font-size: 16px; font-weight: 700; color: #059669;">$${c.gmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                        <div style="font-size: 11px; color: #6b7280;">${pctOfTotal.toFixed(1)}% of total</div>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${includeVideos && data.videos.length > 0 ? `
                    <!-- ===== TOP VIDEOS ===== -->
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="font-size: 24px;">🎬</span>
                            <span style="font-size: 18px; font-weight: 700;">Top Performing Videos</span>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${data.videos.slice(0, 10).map((v, i) => {
                                const vUrl = videoUrl(v);
                                const title = v.video_title || 'Untitled Video';
                                const displayTitle = title.length > 60 ? title.substring(0, 60) + '...' : title;
                                return `
                                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: ${i % 2 === 0 ? '#f9fafb' : 'white'}; border-radius: 10px;">
                                    <div style="width: 28px; text-align: center;">${medal(i)}</div>
                                    <div style="flex: 1; min-width: 0;">
                                        ${vUrl ? `<a href="${vUrl}" target="_blank" style="font-weight: 500; color: #1a1a1a; text-decoration: none; font-size: 13px; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayTitle}</a>` : `<span style="font-size: 13px; color: #1a1a1a;">${displayTitle}</span>`}
                                        <a href="${creatorUrl(v.creator_name)}" target="_blank" style="font-size: 12px; color: #6b7280; text-decoration: none;">@${v.creator_name}</a>
                                    </div>
                                    <div style="text-align: right; min-width: 80px;">
                                        <div style="font-size: 15px; font-weight: 700; color: #059669;">$${v.gmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${includeProducts && data.products.length > 0 ? `
                    <!-- ===== TOP PRODUCTS ===== -->
                    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
                            <span style="font-size: 24px;">📦</span>
                            <span style="font-size: 18px; font-weight: 700;">Top Products</span>
                        </div>
                        
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            ${data.products.map((p, i) => `
                                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: ${i % 2 === 0 ? '#f9fafb' : 'white'}; border-radius: 10px;">
                                    <div style="width: 28px; text-align: center; font-weight: 700; color: ${i < 3 ? '#f5c518' : '#9ca3af'};">${i + 1}</div>
                                    <div style="flex: 1; font-size: 13px; font-weight: 500; color: #1a1a1a;">${p.product_name}</div>
                                    <div style="text-align: right;">
                                        <div style="font-size: 14px; font-weight: 700; color: #059669;">$${p.gmv.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                        <div style="font-size: 11px; color: #6b7280;">${p.orders.toLocaleString()} orders</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- ===== FOOTER ===== -->
                    <div style="text-align: center; padding: 24px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 12px;">
                        <div style="margin-bottom: 8px;">Report generated ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</div>
                        ${includeAgencyLogo ? '<div style="font-weight: 500; color: #6b7280;">Creators Corner • TikTok Shop Creator Marketing</div>' : ''}
                    </div>
                </div>
            `;
        }
        
        async function generateClientReport() {
            const brand = document.getElementById('clientReportBrand').value;
            const period = document.getElementById('clientReportPeriod').value;
            const dateRange = getReportDateRange(period);
            
            showToast('Generating report...', 'info');
            
            try {
                const data = await fetchClientReportData(brand, dateRange);
                const html = generateClientReportHTML(brand, dateRange, data);
                
                // Open in new window (user can Ctrl+P > Save as PDF to preserve links)
                const printWindow = window.open('', '_blank');
                printWindow.document.write(
                    '<!DOCTYPE html>' +
                    '<html>' +
                    '<head>' +
                    '<meta charset="UTF-8">' +
                    '<title>' + (BRAND_DISPLAY[brand] || brand) + ' Performance Report - ' + dateRange.display + '</title>' +
                    '<style>' +
                    'body { margin: 0; padding: 40px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }' +
                    '@media print { ' +
                    '  body { padding: 20px; }' +
                    '  .no-print { display: none !important; }' +
                    '  a { color: #059669 !important; text-decoration: underline !important; }' +
                    '}' +
                    '</style>' +
                    '</head>' +
                    '<body>' +
                    '<div class="no-print" style="background: #1a1a1a; color: white; padding: 16px 24px; margin: -40px -40px 24px -40px; display: flex; justify-content: space-between; align-items: center;">' +
                    '  <span>💡 <strong>To save as PDF with clickable links:</strong> Press <kbd style="background: #333; padding: 4px 8px; border-radius: 4px; margin: 0 4px;">Ctrl+P</kbd> (or <kbd style="background: #333; padding: 4px 8px; border-radius: 4px; margin: 0 4px;">⌘+P</kbd>) → Select "Save as PDF"</span>' +
                    '  <button onclick="window.print()" style="background: #f5c518; color: #1a1a1a; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer;">🖨️ Print / Save PDF</button>' +
                    '</div>' +
                    html +
                    '</body>' +
                    '</html>'
                );
                printWindow.document.close();
                
                showToast('Report opened in new tab!', 'success');
                closeClientReportModal();
            } catch (err) {
                showToast('Error generating report: ' + err.message, 'error');
                console.error(err);
            }
        }

        // ==================== INVOICE GENERATION ====================
        let cachedEarningsData = null;
        
        function openInvoiceModal() {
            document.getElementById('invoiceModal').classList.add('show');
            previewInvoice();
        }
        
        function closeInvoiceModal() {
            document.getElementById('invoiceModal').classList.remove('show');
        }
        
        function exportEarningsSummary() {
            if (!cachedEarningsData) {
                showToast('Please calculate earnings first', 'error');
                return;
            }
            
            const month = document.getElementById('revShareMonth')?.value || 'unknown';
            const rows = [
                ['Brand', 'Affiliate GMV', 'Marketing GMV', 'Total GMV', 'Commission %', 'Commission', 'Base Retainer', 'Launch Fee', 'Launch Name', 'Total', 'Tyler (50%)', 'Matt (50%)'],
                ...cachedEarningsData.brandRows.map(r => [
                    BRAND_DISPLAY[r.brand] || r.brand,
                    r.affiliateGmv.toFixed(2),
                    r.marketingGmv.toFixed(2),
                    r.gmv.toFixed(2),
                    r.rate + '%',
                    r.commission.toFixed(2),
                    r.retainer.toFixed(2),
                    r.launchFee.amount.toFixed(2),
                    r.launchFee.name || '',
                    r.total.toFixed(2),
                    r.tyler.toFixed(2),
                    r.matt.toFixed(2)
                ]),
                [],
                ['TOTAL', cachedEarningsData.totalAffiliateGmv.toFixed(2), cachedEarningsData.totalMarketingGmv.toFixed(2), cachedEarningsData.totalGmv.toFixed(2), '', cachedEarningsData.totalCommission.toFixed(2), cachedEarningsData.totalRetainers.toFixed(2), cachedEarningsData.totalLaunchFees.toFixed(2), '', cachedEarningsData.totalEarnings.toFixed(2), cachedEarningsData.tylerTotal.toFixed(2), cachedEarningsData.mattTotal.toFixed(2)]
            ];
            
            const csv = rows.map(row => row.join(',')).join('\n');
            downloadCSV(csv, `earnings-summary-${month}.csv`);
            showToast('Earnings summary exported!', 'success');
        }
        
        async function previewInvoice() {
            if (!cachedEarningsData) {
                document.getElementById('invoicePreview').innerHTML = '<p style="text-align: center; color: #666;">Please calculate earnings first</p>';
                return;
            }
            
            // Get first selected brand for preview
            const brandMap = {
                'catakor': 'invoiceCatakor',
                'jiyu': 'invoiceJiyu',
                'physicians_choice': 'invoicePC',
                'peach_slices': 'invoicePeach',
                'yerba_magic': 'invoiceYerba'
            };
            
            let previewBrand = null;
            for (const [brand, checkboxId] of Object.entries(brandMap)) {
                if (document.getElementById(checkboxId)?.checked) {
                    previewBrand = brand;
                    break;
                }
            }
            
            if (!previewBrand) {
                document.getElementById('invoicePreview').innerHTML = '<p style="text-align: center; color: #666;">Select at least one brand</p>';
                return;
            }
            
            const invoiceHtml = await generateInvoiceHTML(previewBrand);
            document.getElementById('invoicePreview').innerHTML = invoiceHtml;
        }
        
        async function generateInvoiceHTML(brand) {
            const monthValue = document.getElementById('revShareMonth')?.value;
            if (!monthValue || !cachedEarningsData) return '<p>No data available</p>';
            
            const [year, month] = monthValue.split('-').map(Number);
            const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
            const invoiceDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            const invoiceNum = `INV-${year}${String(month).padStart(2, '0')}-${brand.substring(0, 3).toUpperCase()}`;
            
            const brandData = cachedEarningsData.brandRows.find(r => r.brand === brand);
            if (!brandData) return '<p>No data for this brand</p>';
            
            // Get top creators for this brand
            const topCreators = cachedEarningsData.topCreatorsByBrand?.[brand] || [];
            
            // Check for custom rates in this brand
            const brandCreators = cachedEarningsData.creatorGmvByBrand?.[brand] || {};
            const brandRate = (getRevShareRates()[brand] || 2) / 100;
            const creatorsWithCustomRates = Object.values(brandCreators)
                .map(c => ({
                    ...c,
                    rate: getCreatorRate(brand, c.creator_name),
                    commission: c.gmv * getCreatorRate(brand, c.creator_name)
                }))
                .filter(c => Math.abs(c.rate - brandRate) > 0.001)
                .sort((a, b) => b.gmv - a.gmv);
            
            const hasCustomRates = creatorsWithCustomRates.length > 0;
            
            return `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #f5c518; padding-bottom: 20px;">
                        <div>
                            <div style="font-size: 28px; font-weight: 700; color: #f5c518; margin-bottom: 4px;">CREATORS CORNER</div>
                            <div style="color: #666; font-size: 14px;">Creator Marketing Agency</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 24px; font-weight: 700; color: #1a1a1a;">INVOICE</div>
                            <div style="color: #666; font-size: 14px;">${invoiceNum}</div>
                        </div>
                    </div>
                    
                    <!-- Bill To & Invoice Details -->
                    <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                        <div>
                            <div style="font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: 8px;">Bill To</div>
                            <div style="font-size: 18px; font-weight: 600; color: #1a1a1a;">${BRAND_DISPLAY[brand] || brand}</div>
                            <div style="color: #666; font-size: 14px;">TikTok Shop Partner</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="margin-bottom: 8px;">
                                <span style="color: #888; font-size: 12px;">Invoice Date:</span>
                                <span style="color: #1a1a1a; font-weight: 500; margin-left: 8px;">${invoiceDate}</span>
                            </div>
                            <div style="margin-bottom: 8px;">
                                <span style="color: #888; font-size: 12px;">Period:</span>
                                <span style="color: #1a1a1a; font-weight: 500; margin-left: 8px;">${monthName}</span>
                            </div>
                            <div>
                                <span style="color: #888; font-size: 12px;">Due Date:</span>
                                <span style="color: #1a1a1a; font-weight: 500; margin-left: 8px;">Upon Receipt</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Performance Summary -->
                    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                        <div style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 16px;">📊 Performance Summary</div>
                        <div style="display: grid; grid-template-columns: repeat(${brandData.marketingGmv > 0 ? '4' : '3'}, 1fr); gap: 16px; text-align: center;">
                            <div>
                                <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Affiliate GMV</div>
                                <div style="font-size: 20px; font-weight: 700; color: #1a1a1a;">$${brandData.affiliateGmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            ${brandData.marketingGmv > 0 ? `
                            <div>
                                <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Marketing GMV</div>
                                <div style="font-size: 20px; font-weight: 700; color: #7c3aed;">$${brandData.marketingGmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            </div>
                            ` : ''}
                            <div>
                                <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Active Creators</div>
                                <div style="font-size: 20px; font-weight: 700; color: #1a1a1a;">${topCreators.length || '—'}</div>
                            </div>
                            <div>
                                <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Effective Rate</div>
                                <div style="font-size: 20px; font-weight: 700; color: #1a1a1a;">${brandData.effectiveRate.toFixed(2)}%</div>
                            </div>
                        </div>
                        ${brandData.marketingGmv > 0 ? `
                        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center;">
                            <span style="font-size: 12px; color: #888;">Total Managed GMV:</span>
                            <span style="font-size: 16px; font-weight: 700; color: #1a1a1a; margin-left: 8px;">$${brandData.gmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <!-- Line Items -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                        <thead>
                            <tr style="border-bottom: 2px solid #e5e7eb;">
                                <th style="text-align: left; padding: 12px 0; font-size: 12px; color: #888; text-transform: uppercase;">Description</th>
                                <th style="text-align: right; padding: 12px 0; font-size: 12px; color: #888; text-transform: uppercase;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${brandData.affiliateGmv > 0 ? `
                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 16px 0;">
                                    <div style="font-weight: 500; color: #1a1a1a;">Affiliate Creator Commission</div>
                                    <div style="font-size: 13px; color: #666;">${topCreators.length} creators • ${Math.abs(brandData.effectiveRate - brandData.rate) > 0.01 
                                        ? `Variable rates (avg ${(topCreators.reduce((s, c) => s + (c.gmv * getCreatorRate(brand, c.creator_name)), 0) / brandData.affiliateGmv * 100).toFixed(2)}%)`
                                        : `${brandData.rate}%`
                                    } on $${brandData.affiliateGmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GMV</div>
                                </td>
                                <td style="text-align: right; padding: 16px 0; font-weight: 500; color: #1a1a1a;">$${topCreators.reduce((s, c) => s + (c.gmv * getCreatorRate(brand, c.creator_name)), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${brandData.marketingGmv > 0 ? `
                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 16px 0;">
                                    <div style="font-weight: 500; color: #1a1a1a;">Marketing Account Commission</div>
                                    <div style="font-size: 13px; color: #666;">1% on $${brandData.marketingGmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} marketing GMV</div>
                                </td>
                                <td style="text-align: right; padding: 16px 0; font-weight: 500; color: #1a1a1a;">$${(brandData.marketingGmv * 0.01).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${brandData.retainer > 0 ? `
                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 16px 0;">
                                    <div style="font-weight: 500; color: #1a1a1a;">Monthly Retainer</div>
                                    <div style="font-size: 13px; color: #666;">Creator management & support services</div>
                                </td>
                                <td style="text-align: right; padding: 16px 0; font-weight: 500; color: #1a1a1a;">$${brandData.retainer.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                            ${brandData.launchFee?.amount > 0 ? `
                            <tr style="border-bottom: 1px solid #e5e7eb;">
                                <td style="padding: 16px 0;">
                                    <div style="font-weight: 500; color: #1a1a1a;">Launch Fee</div>
                                    <div style="font-size: 13px; color: #666;">${brandData.launchFee.name || 'Product launch support'}</div>
                                </td>
                                <td style="text-align: right; padding: 16px 0; font-weight: 500; color: #1a1a1a;">$${brandData.launchFee.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                            ` : ''}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td style="padding: 20px 0; font-size: 18px; font-weight: 700; color: #1a1a1a;">Total Due</td>
                                <td style="text-align: right; padding: 20px 0; font-size: 24px; font-weight: 700; color: #16a34a;">$${brandData.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                        </tfoot>
                    </table>
                    
                    ${topCreators.length > 0 || brandData.marketingGmv > 0 ? `
                    <!-- All Creators Breakdown -->
                    <div style="margin-bottom: 30px;">
                        <div style="font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 12px;">👥 GMV Breakdown</div>
                        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                            <thead>
                                <tr style="background: #f8f9fa;">
                                    <th style="text-align: left; padding: 6px 10px; color: #666;">#</th>
                                    <th style="text-align: left; padding: 6px 10px; color: #666;">Source</th>
                                    <th style="text-align: right; padding: 6px 10px; color: #666;">GMV</th>
                                    <th style="text-align: center; padding: 6px 10px; color: #666;">Rate</th>
                                    <th style="text-align: right; padding: 6px 10px; color: #666;">Commission</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${topCreators.map((c, i) => {
                                    const creatorRate = getCreatorRate(brand, c.creator_name);
                                    const creatorCommission = c.gmv * creatorRate;
                                    const isCustom = Math.abs(creatorRate - brandRate) > 0.001;
                                    return `
                                    <tr style="border-bottom: 1px solid #e5e7eb;">
                                        <td style="padding: 6px 10px; color: #888;">${i + 1}</td>
                                        <td style="padding: 6px 10px; color: #1a1a1a;">@${c.creator_name}</td>
                                        <td style="text-align: right; padding: 6px 10px; color: #1a1a1a;">$${c.gmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style="text-align: center; padding: 6px 10px; color: ${isCustom ? '#f59e0b' : '#666'}; font-weight: ${isCustom ? '600' : '400'};">${(creatorRate * 100).toFixed(1)}%</td>
                                        <td style="text-align: right; padding: 6px 10px; font-weight: 500; color: #16a34a;">$${creatorCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    </tr>
                                `}).join('')}
                                ${brandData.marketingGmv > 0 ? `
                                <tr style="border-bottom: 1px solid #e5e7eb; background: #f5f3ff;">
                                    <td style="padding: 6px 10px; color: #7c3aed;">📣</td>
                                    <td style="padding: 6px 10px; color: #7c3aed; font-weight: 500;">Marketing Account</td>
                                    <td style="text-align: right; padding: 6px 10px; color: #7c3aed; font-weight: 500;">$${brandData.marketingGmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td style="text-align: center; padding: 6px 10px; color: #7c3aed;">1.0%</td>
                                    <td style="text-align: right; padding: 6px 10px; font-weight: 500; color: #7c3aed;">$${(brandData.marketingGmv * 0.01).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                                ` : ''}
                            </tbody>
                            <tfoot>
                                <tr style="background: #f0fdf4; font-weight: 600;">
                                    <td colspan="2" style="padding: 8px 10px; color: #1a1a1a;">TOTAL${brandData.marketingGmv > 0 ? ` (${topCreators.length} creators + marketing)` : ` (${topCreators.length} creators)`}</td>
                                    <td style="text-align: right; padding: 8px 10px; color: #1a1a1a;">$${brandData.gmv.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                    <td style="text-align: center; padding: 8px 10px; color: #666;">${brandData.effectiveRate.toFixed(2)}%</td>
                                    <td style="text-align: right; padding: 8px 10px; color: #16a34a;">$${brandData.commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    ` : ''}
                    
                    ${hasCustomRates ? `
                    <!-- Custom Rates Summary -->
                    <div style="margin-bottom: 30px; padding: 12px 16px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px;">
                        <div style="font-size: 13px; font-weight: 600; color: #92400e; margin-bottom: 8px;">📋 Custom Rate Summary</div>
                        <div style="font-size: 12px; color: #78350f;">
                            ${creatorsWithCustomRates.length} creator(s) have adjusted rates (highlighted in orange above). 
                            Standard rate: ${(brandRate * 100).toFixed(1)}%
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- Footer -->
                    <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #888; font-size: 13px;">
                        <p style="margin-bottom: 8px;">Thank you for partnering with Creators Corner!</p>
                        <p>Questions? Contact us at creators.corner.agency@gmail.com</p>
                    </div>
                </div>
            `;
        }
        
        async function generateAllInvoices() {
            if (!cachedEarningsData) {
                showToast('Please calculate earnings first', 'error');
                return;
            }
            
            const brandMap = {
                'catakor': 'invoiceCatakor',
                'jiyu': 'invoiceJiyu',
                'physicians_choice': 'invoicePC',
                'peach_slices': 'invoicePeach',
                'yerba_magic': 'invoiceYerba'
            };
            
            const selectedBrands = [];
            for (const [brand, checkboxId] of Object.entries(brandMap)) {
                if (document.getElementById(checkboxId)?.checked) {
                    selectedBrands.push(brand);
                }
            }
            
            if (selectedBrands.length === 0) {
                showToast('Select at least one brand', 'error');
                return;
            }
            
            // Generate invoices for each selected brand
            for (const brand of selectedBrands) {
                const invoiceHtml = await generateInvoiceHTML(brand);
                const monthValue = document.getElementById('revShareMonth')?.value || 'unknown';
                
                // Create a printable window
                const printWindow = window.open('', '_blank');
                printWindow.document.write(
                    '<!DOCTYPE html>' +
                    '<html>' +
                    '<head>' +
                    '<title>Invoice - ' + (BRAND_DISPLAY[brand] || brand) + ' - ' + monthValue + '</title>' +
                    '<style>body { margin: 0; padding: 20px; } @media print { body { padding: 0; } }</style>' +
                    '</head>' +
                    '<body>' +
                    invoiceHtml +
                    '<script>window.onload = function() { window.print(); }</' + 'script>' +
                    '</body>' +
                    '</html>'
                );
                printWindow.document.close();
            }
            
            showToast(`Generated ${selectedBrands.length} invoice(s)`, 'success');
            closeInvoiceModal();
        }

        // ==================== NOTIFICATION CENTER ====================
        let notifications = [];
        let notificationFilter = 'all';
        
        function toggleNotificationCenter(event) {
            event.stopPropagation();
            const center = document.getElementById('notificationCenter');
            center.classList.toggle('show');
            
            if (center.classList.contains('show')) {
                loadNotifications();
            }
        }
        
        function closeNotificationCenter() {
            document.getElementById('notificationCenter')?.classList.remove('show');
        }
        
        // Close notification center when clicking outside
        document.addEventListener('click', (e) => {
            const center = document.getElementById('notificationCenter');
            const bell = document.getElementById('notificationBell');
            if (center && !center.contains(e.target) && !bell?.contains(e.target)) {
                center.classList.remove('show');
            }
        });
        
        async function loadNotifications() {
            try {
                // Generate notifications from various sources
                notifications = [];
                
                // 1. Get pending applications
                const { data: pendingApps } = await supabaseClient
                    .from('creator_applications')
                    .select('id, full_name, brand, created_at')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(5);
                
                if (pendingApps) {
                    pendingApps.forEach(app => {
                        notifications.push({
                            id: `app-${app.id}`,
                            type: 'application',
                            icon: '📋',
                            iconClass: 'application',
                            title: 'New Application',
                            message: `${app.full_name} applied for ${BRAND_DISPLAY[app.brand] || app.brand}`,
                            time: app.created_at,
                            action: () => { switchView('applications'); closeNotificationCenter(); },
                            read: false
                        });
                    });
                }
                
                // 2. Get pending payments
                const { data: pendingPayments } = await supabaseClient
                    .from('payment_status')
                    .select('id, creator_handle, amount, created_at')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(5);
                
                if (pendingPayments) {
                    const totalPending = pendingPayments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
                    if (pendingPayments.length > 0) {
                        notifications.push({
                            id: 'payments-pending',
                            type: 'alert',
                            icon: '💰',
                            iconClass: 'payment',
                            title: 'Payments Pending',
                            message: `${pendingPayments.length} payments (${fmtMoney(totalPending)}) need processing`,
                            time: pendingPayments[0].created_at,
                            action: () => { switchView('payments'); closeNotificationCenter(); },
                            read: false
                        });
                    }
                }
                
                // 3. Check for recent wins (top performers in last 7 days)
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const { data: recentWins } = await supabaseClient
                    .from('creator_performance')
                    .select('creator_name, brand, gmv')
                    .gte('report_date', sevenDaysAgo.toISOString().split('T')[0])
                    .order('gmv', { ascending: false })
                    .limit(3);
                
                if (recentWins && recentWins.length > 0) {
                    const topCreator = recentWins[0];
                    if (topCreator.gmv >= 1000) {
                        notifications.push({
                            id: `win-${topCreator.creator_name}`,
                            type: 'win',
                            icon: '🎉',
                            iconClass: 'win',
                            title: 'Top Performer!',
                            message: `${topCreator.creator_name} hit ${fmtMoney(topCreator.gmv)} GMV this week`,
                            time: new Date().toISOString(),
                            action: () => { switchView('creators'); closeNotificationCenter(); },
                            read: false
                        });
                    }
                }
                
                // 4. Check for payment issues
                const { data: paymentIssues } = await supabaseClient
                    .from('payment_status')
                    .select('id, creator_handle, amount')
                    .eq('status', 'issue')
                    .limit(5);
                
                if (paymentIssues && paymentIssues.length > 0) {
                    notifications.push({
                        id: 'payment-issues',
                        type: 'alert',
                        icon: '⚠️',
                        iconClass: 'alert',
                        title: 'Payment Issues',
                        message: `${paymentIssues.length} payment(s) flagged with issues`,
                        time: new Date().toISOString(),
                        action: () => { switchView('payments'); closeNotificationCenter(); },
                        read: false
                    });
                }
                
                // 5. Check for missing data (from data health)
                const { data: dataHealth, error: dhError } = await supabaseClient.rpc('get_data_health', { p_days_back: 3 });
                if (dataHealth && !dhError) {
                    const missingCount = dataHealth.filter(d => !d.has_data).length;
                    
                    if (missingCount > 0) {
                        notifications.push({
                            id: 'data-missing',
                            type: 'alert',
                            icon: '📊',
                            iconClass: 'alert',
                            title: 'Missing Data',
                            message: `${missingCount} brand-days missing uploads in last 3 days`,
                            time: new Date().toISOString(),
                            action: () => { switchView('datastatus'); closeNotificationCenter(); },
                            read: false
                        });
                    }
                }
                
                // Sort by time (newest first)
                notifications.sort((a, b) => new Date(b.time) - new Date(a.time));
                
                // Update UI
                renderNotifications();
                updateNotificationBadge();
                
            } catch (err) {
                console.error('Error loading notifications:', err);
            }
        }
        
        function renderNotifications() {
            const list = document.getElementById('notificationList');
            if (!list) return;
            
            let filtered = notifications;
            if (notificationFilter === 'wins') {
                filtered = notifications.filter(n => n.type === 'win');
            } else if (notificationFilter === 'alerts') {
                filtered = notifications.filter(n => n.type === 'alert');
            } else if (notificationFilter === 'apps') {
                filtered = notifications.filter(n => n.type === 'application');
            }
            
            if (filtered.length === 0) {
                list.innerHTML = `
                    <div class="notification-empty">
                        <div class="empty-icon">✨</div>
                        <div>All caught up!</div>
                    </div>
                `;
                return;
            }
            
            list.innerHTML = filtered.map(n => `
                <div class="notification-item ${n.read ? '' : 'unread'}" onclick="handleNotificationClick('${n.id}')">
                    <div class="notification-icon ${n.iconClass}">${n.icon}</div>
                    <div class="notification-content">
                        <div class="title">${n.title}</div>
                        <div class="message">${n.message}</div>
                        <div class="time">${formatTimeAgo(n.time)}</div>
                    </div>
                </div>
            `).join('');
            
            // Update tab counts
            document.getElementById('tabCountAll').textContent = notifications.length;
        }
        
        function filterNotifications(filter) {
            notificationFilter = filter;
            
            // Update active tab
            document.querySelectorAll('.notification-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === filter);
            });
            
            renderNotifications();
        }
        
        function handleNotificationClick(id) {
            const notification = notifications.find(n => n.id === id);
            if (notification) {
                notification.read = true;
                if (notification.action) {
                    notification.action();
                }
                updateNotificationBadge();
            }
        }
        
        function markAllNotificationsRead() {
            notifications.forEach(n => n.read = true);
            renderNotifications();
            updateNotificationBadge();
            showToast('All notifications marked as read', 'success');
        }
        
        function updateNotificationBadge() {
            const unreadCount = notifications.filter(n => !n.read).length;
            const badge = document.getElementById('notificationCount');
            const bell = document.getElementById('notificationBell');
            
            if (badge) {
                badge.textContent = unreadCount;
                badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
            }
            
            if (bell) {
                bell.classList.toggle('has-alerts', unreadCount > 0);
            }
        }
        
        function formatTimeAgo(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString();
        }
        
        // Load notifications on page load
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(loadNotifications, 2000); // Load after initial data
            // Refresh every 5 minutes
            setInterval(loadNotifications, 300000);
        });

