// ==================== OPS CENTER ====================
        // ==================== OPS CENTER ====================
        let opsData = {
            creators: [],
            videos: [],
            currentQuadrant: 'all',
            currentTab: 'overview',
            overviewLoaded: false,
            videosLoaded: false,
            postingLoaded: false,
            creatorsLoaded: false,
            decisionsLoaded: false
        };
        
        // Thresholds for quadrant classification
        const OPS_THRESHOLDS = {
            highVideos: 5,  // 5+ videos in period = high output
            highGmv: 500    // $500+ GMV in period = high GMV
        };
        
        // Legacy function - kept for compatibility
        async function onOpsBrandFilterChange() {
            // No longer used - filters are now tab-specific
            reloadCurrentOpsTab();
        }
        
        function switchOpsTab(tab) {
            opsData.currentTab = tab;
            
            // Update tab styling
            document.querySelectorAll('.ops-tab').forEach(t => {
                t.classList.remove('active');
                t.style.background = 'transparent';
                t.style.color = 'var(--text-muted)';
                t.style.boxShadow = 'none';
            });
            const activeTab = document.querySelector(`.ops-tab[data-tab="${tab}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
                activeTab.style.background = 'var(--bg-card)';
                activeTab.style.color = 'var(--text-primary)';
                activeTab.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            }
            
            // Show/hide tab content
            document.querySelectorAll('.ops-tab-content').forEach(c => c.style.display = 'none');
            
            // Special handling for overview tab - show embedded overview content
            if (tab === 'overview') {
                const opsOverview = document.getElementById('ops-tab-overview');
                if (opsOverview) {
                    opsOverview.style.display = 'block';
                    // Load overview data if not loaded
                    if (!opsData.overviewLoaded) {
                        opsData.overviewLoaded = true;
                        loadOverviewData();
                    }
                }
            } else {
                const content = document.getElementById(`ops-tab-${tab}`);
                if (content) content.style.display = 'block';
            }
            
            // Load data for the tab if not loaded yet
            if (tab === 'videos' && !opsData.videosLoaded) {
                opsData.videosLoaded = true;
                const brand = document.getElementById('videosBrandFilter')?.value || 'all';
                loadVideoProductsFromData(brand);
                loadVideosTab();
            }
            if (tab === 'posting' && !opsData.postingLoaded) {
                opsData.postingLoaded = true;
                loadPostingData();
            }
            if (tab === 'creators' && !opsData.creatorsLoaded) {
                opsData.creatorsLoaded = true;
                loadCreatorsTab();
            }
            if (tab === 'decisions' && !opsData.decisionsLoaded) {
                opsData.decisionsLoaded = true;
                loadDecisions();
            }
        }
        
        // Reload data based on which tab is currently active
        function reloadCurrentOpsTab() {
            if (opsData.currentTab === 'overview') {
                loadOverviewData();
            } else if (opsData.currentTab === 'videos') {
                loadVideosTab();
            } else if (opsData.currentTab === 'posting') {
                loadPostingData();
            } else if (opsData.currentTab === 'creators') {
                loadCreatorsTab();
            } else if (opsData.currentTab === 'decisions') {
                loadDecisions();
            }
        }
        
        // ==================== VIDEOS TAB ====================
        // Cache for videos data
        let videosTabCache = { all: [], hot: [], rising: [], top: [], efficiency: [] };
        
        // Toggle video section visibility
        function toggleVideoSection(section) {
            const content = document.getElementById(section + 'Content');
            const toggle = document.getElementById(section + 'Toggle');
            if (!content || !toggle) return;
            
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggle.textContent = isHidden ? '▼' : '▶';
        }
        
        // Scroll to video section
        function scrollToVideoSection(section) {
            const el = document.getElementById('videoSection' + section.charAt(0).toUpperCase() + section.slice(1));
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Expand section if collapsed
                const content = document.getElementById(section + 'Content');
                if (content && content.style.display === 'none') {
                    toggleVideoSection(section);
                }
            }
        }
        
        // Render a video card
        function renderVideoCard(v, badge = null) {
            const postedDate = v.post_date ? new Date(v.post_date + 'T00:00:00') : null;
            const daysAgo = postedDate ? Math.floor((new Date() - postedDate) / (1000 * 60 * 60 * 24)) : null;
            const dateDisplay = daysAgo !== null ? (daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`) : '';
            const creatorHandle = (v.creator_name || '').replace('@', '');
            const profileUrl = creatorHandle ? `https://www.tiktok.com/@${creatorHandle}` : '#';
            const videoUrl = v.video_id && creatorHandle ? `https://www.tiktok.com/@${creatorHandle}/video/${v.video_id}` : '#';
            const isManaged = isManagedForBrand(v.creator_name, v.brand);
            const brandColor = BRAND_COLORS[v.brand] || '#666';
            const thumbId = `thumb-${v.video_id || Math.random().toString(36).slice(2)}`;
            
            return `
                <div class="video-card" style="background: var(--bg-secondary); border-radius: 12px; overflow: hidden; border: 1px solid var(--border); position: relative; transition: transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.2)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
                    <!-- Badge -->
                    ${badge ? `<div style="position: absolute; top: 8px; right: 8px; background: ${badge.bg}; color: ${badge.color}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 700; z-index: 2;">${badge.text}</div>` : ''}
                    
                    <!-- Video Thumbnail with Play Button -->
                    <div class="video-thumb-container" id="${thumbId}" data-video-id="${v.video_id || ''}" data-creator="${creatorHandle}" 
                         style="position: relative; width: 100%; aspect-ratio: 9/16; max-height: 280px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); cursor: pointer; overflow: hidden;"
                         onclick="playVideoEmbed('${v.video_id}', '${creatorHandle}')">
                        <img class="video-thumb-img" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23374151' width='100' height='100'/%3E%3C/svg%3E" 
                             style="width: 100%; height: 100%; object-fit: cover; opacity: 0.3; transition: opacity 0.3s;"
                             onerror="this.style.display='none'">
                        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;">
                            <div style="width: 50px; height: 50px; border-radius: 50%; background: rgba(255,255,255,0.9); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                                <span style="font-size: 1.5rem; margin-left: 4px;">▶</span>
                            </div>
                            <span style="color: white; font-size: 0.7rem; text-shadow: 0 1px 3px rgba(0,0,0,0.5);">Click to play</span>
                        </div>
                        <!-- GMV Overlay -->
                        <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 12px;">
                            <div style="color: #22c55e; font-size: 1.4rem; font-weight: 800;">$${(v.gmv || 0).toLocaleString()}</div>
                            <div style="color: rgba(255,255,255,0.7); font-size: 0.7rem;">${(v.orders || 0)} orders</div>
                        </div>
                    </div>
                    
                    <!-- Info -->
                    <div style="padding: 12px;">
                        <!-- Creator + Brand -->
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <a href="${profileUrl}" target="_blank" style="font-weight: 600; font-size: 0.85rem; color: var(--text-primary); text-decoration: none; display: flex; align-items: center; gap: 4px;">
                                ${isManaged ? '<span style="color: #22c55e;">✓</span>' : ''}
                                @${sanitize(creatorHandle || 'Unknown')}
                            </a>
                            <span style="color: ${brandColor}; font-size: 0.7rem; font-weight: 500;">${formatBrandName(v.brand)}</span>
                        </div>
                        
                        <!-- Product Tags -->
                        ${v.product_names && v.product_names.length > 0 ? `
                            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px;">
                                ${v.product_names.slice(0, 2).map(pn => `<span style="background: rgba(139, 92, 246, 0.15); color: #a78bfa; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 500;">📦 ${sanitize(pn)}</span>`).join('')}
                                ${v.product_names.length > 2 ? `<span style="color: var(--text-muted); font-size: 0.65rem;">+${v.product_names.length - 2}</span>` : ''}
                            </div>
                        ` : ''}
                        
                        <!-- Video Title -->
                        <div style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 8px; min-height: 2.1em;">
                            ${sanitize(v.video_title || 'Untitled video')}
                        </div>
                        
                        <!-- Footer -->
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; color: var(--text-muted);">
                            <span>${dateDisplay || '-'}</span>
                            <div style="display: flex; gap: 6px;">
                                <a href="${videoUrl}" target="_blank" style="color: var(--accent); text-decoration: none;">TikTok ↗</a>
                                <button onclick="event.stopPropagation(); copyVideoLink('${videoUrl}')" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0; font-size: 0.7rem;">📋</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Play video in modal embed
        function playVideoEmbed(videoId, creatorHandle) {
            if (!videoId) {
                showToast('No video ID available', 'warning');
                return;
            }
            
            const modal = document.getElementById('videoPlayerModal');
            const embedContainer = document.getElementById('videoEmbedContainer');
            const infoContainer = document.getElementById('videoEmbedInfo');
            
            // Show modal with loading state
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            embedContainer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                    <div class="spinner"></div>
                </div>
            `;
            
            // Load TikTok embed
            setTimeout(() => {
                embedContainer.innerHTML = `
                    <iframe 
                        src="https://www.tiktok.com/embed/v2/${videoId}"
                        style="width: 100%; height: 100%; border: none; border-radius: 12px;"
                        allow="encrypted-media; fullscreen"
                        allowfullscreen
                    ></iframe>
                `;
            }, 100);
            
            // Update info
            if (infoContainer) {
                infoContainer.innerHTML = `
                    <a href="https://www.tiktok.com/@${creatorHandle}" target="_blank" style="color: var(--accent); text-decoration: none; font-weight: 600;">@${creatorHandle}</a>
                    <span style="margin: 0 8px; color: var(--text-muted);">•</span>
                    <a href="https://www.tiktok.com/@${creatorHandle}/video/${videoId}" target="_blank" style="color: var(--text-muted); text-decoration: none;">Open in TikTok ↗</a>
                `;
            }
        }
        
        // Close video player modal
        function closeVideoPlayer() {
            const modal = document.getElementById('videoPlayerModal');
            const embedContainer = document.getElementById('videoEmbedContainer');
            modal.style.display = 'none';
            embedContainer.innerHTML = '';
            document.body.style.overflow = '';
        }
        
        // Load video thumbnails for visible cards
        async function loadVideoThumbnails() {
            const containers = document.querySelectorAll('.video-thumb-container[data-video-id]');
            
            for (const container of containers) {
                const videoId = container.dataset.videoId;
                const creator = container.dataset.creator;
                
                if (!videoId || videoId.length < 5) continue;
                
                const img = container.querySelector('.video-thumb-img');
                if (!img) continue;
                
                // Check if already loaded
                if (img.dataset.loaded === 'true') continue;
                
                try {
                    const videoUrl = `https://www.tiktok.com/@${creator}/video/${videoId}`;
                    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`;
                    
                    const response = await fetch(oembedUrl);
                    if (!response.ok) continue;
                    
                    const data = await response.json();
                    if (data.thumbnail_url) {
                        img.src = data.thumbnail_url;
                        img.style.opacity = '1';
                        img.dataset.loaded = 'true';
                    }
                } catch (err) {
                    // Silently fail - thumbnail just won't load
                }
            }
        }
        
        // Render efficiency card for a creator
        function renderEfficiencyCard(c) {
            const efficiency = c.gmvPerVideo >= 100 ? 'high' : c.gmvPerVideo >= 30 ? 'medium' : 'low';
            const effConfig = {
                high: { emoji: '🔥', color: 'var(--success)', label: 'Crushing it', tip: 'Averaging $100+ per video - top performer!' },
                medium: { emoji: '⚡', color: 'var(--warning)', label: 'Solid', tip: 'Averaging $30-99 per video - consistent performer' },
                low: { emoji: '💤', color: 'var(--text-muted)', label: 'Room to grow', tip: 'Under $30 per video - may need coaching or better content strategy' }
            };
            const eff = effConfig[efficiency];
            const creatorHandle = (c.name || '').replace('@', '');
            const profileUrl = creatorHandle ? `https://www.tiktok.com/@${creatorHandle}` : '#';
            const isManaged = isManagedForBrand(c.name, c.brand);
            
            return `
                <div style="background: var(--bg-secondary); border-radius: 12px; padding: 16px; border: 1px solid var(--border); border-left: 4px solid ${eff.color};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <a href="${profileUrl}" target="_blank" style="font-weight: 700; color: var(--text-primary); text-decoration: none;" title="${isManaged ? 'Managed creator - in our roster' : 'Unmanaged creator'}">
                            ${isManaged ? '<span title="Creator is in our managed roster">✅</span> ' : ''}${sanitize(c.name)}
                        </a>
                        <span style="font-size: 1.5rem;" title="${eff.tip}">${eff.emoji}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; text-align: center;">
                        <div title="Total videos posted by this creator in selected period">
                            <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent);">${c.videos}</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Videos</div>
                        </div>
                        <div title="Total sales generated across all videos">
                            <div style="font-size: 1.1rem; font-weight: 700; color: var(--success);">$${c.gmv.toLocaleString()}</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Total GMV</div>
                        </div>
                        <div title="Average GMV per video (Total GMV ÷ Videos) - ${eff.tip}">
                            <div style="font-size: 1.1rem; font-weight: 700; color: ${eff.color};">$${c.gmvPerVideo.toFixed(0)}</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Per Video</div>
                        </div>
                    </div>
                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
                        <span class="badge" style="font-size: 0.65rem;">${formatBrandName(c.brand)}</span>
                        <span style="color: ${eff.color};" title="${eff.tip}">${eff.label}</span>
                    </div>
                </div>
            `;
        }
        
        // Copy video link
        function copyVideoLink(url) {
            navigator.clipboard.writeText(url);
            showToast('Video link copied!', 'success');
        }
        
        // Copy Discord message for a specific section
        function copyDiscordMessage(section) {
            const brand = document.getElementById('videosBrandFilter')?.value || 'all';
            const brandName = brand === 'all' ? 'All Brands' : BRAND_DISPLAY[brand];
            const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            let text = '';
            let items = [];
            
            switch(section) {
                case 'hot':
                    items = videosTabCache.hot.slice(0, 10);
                    if (items.length === 0) {
                        showToast('No hot videos to copy', 'warning');
                        return;
                    }
                    text = `🔥 **HOT VIDEOS - ${brandName}** 🔥\n`;
                    text += `_New videos crushing it this week (${today})_\n\n`;
                    items.forEach((v, i) => {
                        const creatorHandle = (v.creator_name || '').replace('@', '');
                        const isManaged = isManagedForBrand(v.creator_name, v.brand) ? '✅' : '';
                        text += `**${i + 1}. ${isManaged}@${creatorHandle}** - \`$${(v.gmv || 0).toLocaleString()}\`\n`;
                        if (v.video_id && creatorHandle) {
                            text += `   <https://www.tiktok.com/@${creatorHandle}/video/${v.video_id}>\n`;
                        }
                    });
                    break;
                    
                case 'rising':
                    items = videosTabCache.rising.slice(0, 10);
                    if (items.length === 0) {
                        showToast('No rising videos to copy', 'warning');
                        return;
                    }
                    text = `📈 **RISING VIDEOS - ${brandName}** 📈\n`;
                    text += `_Still performing strong after 7+ days (${today})_\n\n`;
                    items.forEach((v, i) => {
                        const creatorHandle = (v.creator_name || '').replace('@', '');
                        const isManaged = isManagedForBrand(v.creator_name, v.brand) ? '✅' : '';
                        text += `**${i + 1}. ${isManaged}@${creatorHandle}** - \`$${(v.gmv || 0).toLocaleString()}\`\n`;
                        if (v.video_id && creatorHandle) {
                            text += `   <https://www.tiktok.com/@${creatorHandle}/video/${v.video_id}>\n`;
                        }
                    });
                    break;
                    
                case 'top':
                    items = videosTabCache.top.slice(0, 10);
                    if (items.length === 0) {
                        showToast('No top videos to copy', 'warning');
                        return;
                    }
                    text = `🏆 **TOP PERFORMERS - ${brandName}** 🏆\n`;
                    text += `_Highest GMV videos this period (${today})_\n\n`;
                    items.forEach((v, i) => {
                        const creatorHandle = (v.creator_name || '').replace('@', '');
                        const isManaged = isManagedForBrand(v.creator_name, v.brand) ? '✅' : '';
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                        text += `**${medal} ${isManaged}@${creatorHandle}** - \`$${(v.gmv || 0).toLocaleString()}\`\n`;
                        if (v.video_id && creatorHandle) {
                            text += `   <https://www.tiktok.com/@${creatorHandle}/video/${v.video_id}>\n`;
                        }
                    });
                    break;
                    
                case 'efficiency':
                    items = videosTabCache.efficiency.slice(0, 10);
                    if (items.length === 0) {
                        showToast('No efficiency data to copy', 'warning');
                        return;
                    }
                    text = `⚡ **CREATOR EFFICIENCY - ${brandName}** ⚡\n`;
                    text += `_Who's making every video count (${today})_\n\n`;
                    items.forEach((c, i) => {
                        const creatorHandle = (c.name || '').replace('@', '');
                        const isManaged = isManagedForBrand(c.name, c.brand) ? '✅' : '';
                        const eff = c.gmvPerVideo >= 100 ? '🔥' : c.gmvPerVideo >= 30 ? '⚡' : '💤';
                        text += `**${i + 1}. ${isManaged}@${creatorHandle}** ${eff}\n`;
                        text += `   ${c.videos} videos → \`$${c.gmv.toLocaleString()}\` total → \`$${c.gmvPerVideo.toFixed(0)}/video\`\n`;
                    });
                    text += `\n_Legend: 🔥 = $100+/vid, ⚡ = $30-99/vid, 💤 = <$30/vid_`;
                    break;
            }
            
            navigator.clipboard.writeText(text);
            showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} copied for Discord!`, 'success');
        }
        
        // Track expanded state for Show More
        let videosShowAllState = { hot: false, rising: false, top: false, efficiency: false };
        
        // Show more videos in a section
        function showMoreVideos(section) {
            videosShowAllState[section] = true;
            
            // Re-render the section with all items
            const gridId = section === 'efficiency' ? 'efficiencyGrid' : `${section}VideosGrid`;
            const grid = document.getElementById(gridId);
            const items = videosTabCache[section];
            
            if (section === 'efficiency') {
                grid.innerHTML = items.map(c => renderEfficiencyCard(c)).join('');
            } else {
                const badgeConfig = {
                    hot: { text: '🔥 HOT', bg: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white' },
                    rising: { text: '📈 RISING', bg: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' },
                    top: null
                };
                grid.innerHTML = items.map((v, i) => {
                    let badge = badgeConfig[section];
                    if (section === 'top' && i < 3) {
                        badge = { text: `#${i+1}`, bg: 'linear-gradient(135deg, #f5c518, #ca8a04)', color: 'black' };
                    }
                    return renderVideoCard(v, badge);
                }).join('');
            }
            
            // Hide the Show More button
            document.getElementById(`${section}ShowMore`).style.display = 'none';
        }
        
        // Filter ops videos table by search
        function filterOpsVideosTable() {
            const search = document.getElementById('opsVideosSearchInput').value.toLowerCase();
            const rows = document.querySelectorAll('#allVideosTableBody tr');
            let visibleCount = 0;
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const match = text.includes(search);
                row.style.display = match ? '' : 'none';
                if (match) visibleCount++;
            });
            
            // Update count
            document.getElementById('allCount').textContent = visibleCount;
        }
        
        // Export videos to CSV
        function exportVideosCSV() {
            const videos = videosTabCache.all;
            if (videos.length === 0) {
                showToast('No videos to export', 'warning');
                return;
            }
            
            const headers = ['Rank', 'Video Title', 'Creator', 'Brand', 'Posted', 'GMV', 'Orders', 'Managed', 'Video URL'];
            const rows = videos.map((v, i) => {
                const creatorHandle = (v.creator_name || '').replace('@', '');
                const videoUrl = v.video_id && creatorHandle ? `https://www.tiktok.com/@${creatorHandle}/video/${v.video_id}` : '';
                const postedDate = v.post_date || '';
                const isManaged = isManagedForBrand(v.creator_name, v.brand) ? 'Yes' : 'No';
                
                return [
                    i + 1,
                    `"${(v.video_title || 'Untitled').replace(/"/g, '""')}"`,
                    creatorHandle,
                    formatBrandName(v.brand),
                    postedDate,
                    (v.gmv || 0).toFixed(2),
                    v.orders || 0,
                    isManaged,
                    videoUrl
                ].join(',');
            });
            
            const csv = [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `videos-export-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Videos exported!', 'success');
        }
        
        // Filter videos display based on managed status
        function filterVideosDisplay() {
            loadVideosTab();
        }
        
        async function loadVideosTab() {
            const brand = document.getElementById('videosBrandFilter')?.value || 'all';
            const product = document.getElementById('videosProductFilter')?.value || 'all';
            const statusFilter = document.getElementById('videosStatusFilter')?.value || 'all';
            
            // Get date range from Ops Center date picker
            const startStr = document.getElementById('opsDateFilterStart')?.value;
            const endStr = document.getElementById('opsDateFilterEnd')?.value;
            
            let startDate, endDate;
            if (startStr && endStr) {
                startDate = startStr;
                endDate = endStr;
            } else {
                const end = new Date();
                end.setDate(end.getDate() - 1);
                const start = new Date(end);
                start.setDate(start.getDate() - 6);
                startDate = localDateStr(start);
                endDate = localDateStr(end);
            }
            
            // Update context
            const startDisplay = new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endDisplay = new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            document.getElementById('videosTabContext').textContent = `${startDisplay} - ${endDisplay} • ${brand === 'all' ? 'All Brands' : BRAND_DISPLAY[brand]}`;
            
            try {
                
                // Fetch video_performance data - need ordering for consistent results
                let perfQuery = supabaseClient.from('video_performance')
                    .select('*')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate);
                
                if (brand !== 'all') {
                    perfQuery = perfQuery.eq('brand', brand);
                }
                
                // Apply ordering and limit after filters
                perfQuery = perfQuery
                    .order('video_id', { ascending: true })
                    .order('report_date', { ascending: true })
                    .limit(30000);  // Match Supabase global limit
                
                const perfResult = await perfQuery;
                
                if (perfResult.error) throw perfResult.error;
                
                const videos = perfResult.data || [];
                
                // Get unique video_ids from performance data
                const uniqueVideoIds = [...new Set(videos.map(v => v.video_id))];
                
                // Fetch post_dates only for videos we actually have performance data for
                // Batch into chunks of 500 to avoid query size limits
                const postDateMap = new Map();
                const chunkSize = 500;
                
                for (let i = 0; i < uniqueVideoIds.length; i += chunkSize) {
                    const chunk = uniqueVideoIds.slice(i, i + chunkSize);
                    let videosQuery = supabaseClient.from('videos')
                        .select('video_id, post_date')
                        .in('video_id', chunk);
                    
                    if (brand !== 'all') {
                        videosQuery = videosQuery.eq('brand', brand);
                    }
                    
                    const { data: videosData, error: videosError } = await videosQuery;
                    if (!videosError && videosData) {
                        videosData.forEach(v => {
                            if (v.post_date) {
                                postDateMap.set(v.video_id, v.post_date);
                            }
                        });
                    }
                }
                
                // Post date lookup complete
                
                // Filter by product name if selected
                // Filter by product selection (can be group or individual product)
                const productFilterValue = product;
                const productNamesToFilter = getProductNamesForFilter(productFilterValue);
                
                let filteredVideos = videos;
                if (productNamesToFilter && productNamesToFilter.length > 0) {
                    const productSet = new Set(productNamesToFilter);
                    filteredVideos = filteredVideos.filter(v => productSet.has(v.product_name));
                }
                
                // Aggregate by video_id - SUM GMV across all days in range
                const videoMap = new Map();
                filteredVideos.forEach(v => {
                    const existing = videoMap.get(v.video_id);
                    const productName = v.product_name || null;
                    if (!existing) {
                        videoMap.set(v.video_id, {
                            ...v,
                            gmv: v.gmv || 0,
                            orders: v.orders || 0,
                            post_date: postDateMap.get(v.video_id) || null,
                            product_name: productName,
                            product_names: productName ? new Set([productName]) : new Set()
                        });
                    } else {
                        existing.gmv = (existing.gmv || 0) + (v.gmv || 0);
                        existing.orders = (existing.orders || 0) + (v.orders || 0);
                        if (productName) existing.product_names.add(productName);
                        if (v.report_date > existing.report_date) {
                            existing.report_date = v.report_date;
                        }
                    }
                });
                
                let uniqueVideos = Array.from(videoMap.values()).map(v => ({
                    ...v,
                    product_names: v.product_names ? Array.from(v.product_names) : []
                }));
                
                // Apply managed filter
                if (statusFilter === 'managed') {
                    uniqueVideos = uniqueVideos.filter(v => isManagedForBrand(v.creator_name, v.brand));
                } else if (statusFilter === 'unmanaged') {
                    uniqueVideos = uniqueVideos.filter(v => !isManagedForBrand(v.creator_name, v.brand));
                }
                
                const totalVideos = uniqueVideos.length;
                const totalGmv = uniqueVideos.reduce((sum, v) => sum + (v.gmv || 0), 0);
                const avgGmv = totalVideos > 0 ? totalGmv / totalVideos : 0;
                
                // Categorize videos - define date cutoffs
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const sevenDaysAgoStr = localDateStr(sevenDaysAgo);
                
                const fourteenDaysAgo = new Date();
                fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
                const fourteenDaysAgoStr = localDateStr(fourteenDaysAgo);
                
                // HOT NOW: New videos (last 7 days) with $100+ GMV
                const hotVideos = uniqueVideos
                    .filter(v => v.post_date && v.post_date >= sevenDaysAgoStr && (v.gmv || 0) >= 100)
                    .sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
                
                // RISING: Videos posted 7-14 days ago that are still performing well
                const risingVideos = uniqueVideos
                    .filter(v => v.post_date && v.post_date < sevenDaysAgoStr && v.post_date >= fourteenDaysAgoStr && (v.gmv || 0) >= 50)
                    .sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
                
                // TOP PERFORMERS: Highest GMV overall (that aren't already in Hot)
                const hotIds = new Set(hotVideos.map(v => v.video_id));
                const topVideos = uniqueVideos
                    .filter(v => !hotIds.has(v.video_id))
                    .sort((a, b) => (b.gmv || 0) - (a.gmv || 0))
                    .slice(0, 20);
                
                // Creator Efficiency
                const creatorStats = {};
                uniqueVideos.forEach(v => {
                    const key = `${v.creator_name}-${v.brand}`;
                    if (!creatorStats[key]) {
                        creatorStats[key] = { name: v.creator_name, brand: v.brand, videos: 0, gmv: 0 };
                    }
                    creatorStats[key].videos++;
                    creatorStats[key].gmv += (v.gmv || 0);
                });
                
                const efficiencyData = Object.values(creatorStats)
                    .filter(c => c.videos >= 2) // At least 2 videos
                    .map(c => ({ ...c, gmvPerVideo: c.videos > 0 ? c.gmv / c.videos : 0 }))
                    .sort((a, b) => b.gmvPerVideo - a.gmvPerVideo)
                    .slice(0, 20);
                
                // Cache data
                videosTabCache = {
                    all: uniqueVideos,
                    hot: hotVideos,
                    rising: risingVideos,
                    top: topVideos,
                    efficiency: efficiencyData
                };
                
                // Update stats
                document.getElementById('videosStatHot').textContent = hotVideos.length;
                document.getElementById('videosStatRising').textContent = risingVideos.length;
                document.getElementById('videosStatTop').textContent = Math.min(topVideos.length, 10);
                document.getElementById('videosStatTotal').textContent = totalVideos.toLocaleString();
                document.getElementById('videosStatGmv').textContent = '$' + totalGmv.toLocaleString(undefined, {maximumFractionDigits: 0});
                document.getElementById('videosStatAvg').textContent = '$' + avgGmv.toLocaleString(undefined, {maximumFractionDigits: 0});
                
                // Update counts
                document.getElementById('hotCount').textContent = hotVideos.length;
                document.getElementById('risingCount').textContent = risingVideos.length;
                document.getElementById('topCount').textContent = topVideos.length;
                document.getElementById('efficiencyCount').textContent = efficiencyData.length;
                document.getElementById('allCount').textContent = totalVideos;
                
                // Reset show all state on reload
                videosShowAllState = { hot: false, rising: false, top: false, efficiency: false };
                
                const INITIAL_DISPLAY = 12;
                
                // Render HOT NOW section
                const hotGrid = document.getElementById('hotVideosGrid');
                if (hotVideos.length === 0) {
                    hotGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">🔍 No hot videos yet this week. Keep posting!</div>';
                    document.getElementById('hotShowMore').style.display = 'none';
                } else {
                    hotGrid.innerHTML = hotVideos.slice(0, INITIAL_DISPLAY).map(v => 
                        renderVideoCard(v, { text: '🔥 HOT', bg: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white' })
                    ).join('');
                    // Show More button if needed
                    document.getElementById('hotShowMore').style.display = hotVideos.length > INITIAL_DISPLAY ? 'block' : 'none';
                    document.getElementById('hotTotalCount').textContent = hotVideos.length;
                }
                
                // Render RISING section
                const risingGrid = document.getElementById('risingVideosGrid');
                if (risingVideos.length === 0) {
                    risingGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">📈 No rising videos in the 7-14 day window</div>';
                    document.getElementById('risingShowMore').style.display = 'none';
                } else {
                    risingGrid.innerHTML = risingVideos.slice(0, INITIAL_DISPLAY).map(v => 
                        renderVideoCard(v, { text: '📈 RISING', bg: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' })
                    ).join('');
                    document.getElementById('risingShowMore').style.display = risingVideos.length > INITIAL_DISPLAY ? 'block' : 'none';
                    document.getElementById('risingTotalCount').textContent = risingVideos.length;
                }
                
                // Render TOP PERFORMERS section
                const topGrid = document.getElementById('topVideosGrid');
                if (topVideos.length === 0) {
                    topGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">🏆 No videos found in this period</div>';
                    document.getElementById('topShowMore').style.display = 'none';
                } else {
                    topGrid.innerHTML = topVideos.slice(0, INITIAL_DISPLAY).map((v, i) => 
                        renderVideoCard(v, i < 3 ? { text: `#${i+1}`, bg: 'linear-gradient(135deg, #f5c518, #ca8a04)', color: 'black' } : null)
                    ).join('');
                    document.getElementById('topShowMore').style.display = topVideos.length > INITIAL_DISPLAY ? 'block' : 'none';
                    document.getElementById('topTotalCount').textContent = topVideos.length;
                }
                
                // Render EFFICIENCY section
                const effGrid = document.getElementById('efficiencyGrid');
                if (efficiencyData.length === 0) {
                    effGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">⚡ Need more video data to calculate efficiency</div>';
                    document.getElementById('efficiencyShowMore').style.display = 'none';
                } else {
                    effGrid.innerHTML = efficiencyData.slice(0, INITIAL_DISPLAY).map(c => renderEfficiencyCard(c)).join('');
                    document.getElementById('efficiencyShowMore').style.display = efficiencyData.length > INITIAL_DISPLAY ? 'block' : 'none';
                    document.getElementById('efficiencyTotalCount').textContent = efficiencyData.length;
                }
                
                // Render ALL VIDEOS table
                const sortedAll = [...uniqueVideos].sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
                document.getElementById('allVideosTableBody').innerHTML = sortedAll.slice(0, 100).map((v, i) => {
                    const postedDate = v.post_date ? new Date(v.post_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';
                    const creatorHandle = (v.creator_name || '').replace('@', '');
                    const profileUrl = creatorHandle ? `https://www.tiktok.com/@${creatorHandle}` : '#';
                    const videoUrl = v.video_id && creatorHandle ? `https://www.tiktok.com/@${creatorHandle}/video/${v.video_id}` : '#';
                    const isManaged = isManagedForBrand(v.creator_name, v.brand);
                    const isHot = hotIds.has(v.video_id);
                    
                    return `
                        <tr>
                            <td>${i + 1}</td>
                            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${v.video_id ? `<a href="${videoUrl}" target="_blank" style="color: var(--text-primary); text-decoration: none;" title="${sanitize(v.video_title || 'Untitled')}">${sanitize(v.video_title || 'Untitled')}</a>` : sanitize(v.video_title || 'Untitled')}
                            </td>
                            <td>
                                ${isManaged ? '✅ ' : ''}<a href="${profileUrl}" target="_blank" style="color: var(--accent); text-decoration: none;">${sanitize(v.creator_name || 'Unknown')}</a>
                            </td>
                            <td><span class="badge">${formatBrandName(v.brand)}</span></td>
                            <td style="text-align: center; font-size: 0.85rem; color: var(--text-muted);">${postedDate}</td>
                            <td style="text-align: right; font-weight: 600; color: var(--success);">$${(v.gmv || 0).toLocaleString()}</td>
                            <td style="text-align: right;">${(v.orders || 0).toLocaleString()}</td>
                            <td style="text-align: center;">
                                ${isHot ? '<span style="color: #f97316;">🔥</span>' : isManaged ? '<span style="color: var(--success);">✅</span>' : '<span style="color: var(--text-muted);">-</span>'}
                            </td>
                            <td style="text-align: center;">
                                ${v.video_id ? `<a href="${videoUrl}" target="_blank" class="btn btn-small" style="padding: 4px 8px; font-size: 0.75rem;">View</a>` : '-'}
                            </td>
                        </tr>
                    `;
                }).join('') || '<tr><td colspan="9" style="text-align: center; padding: 40px; color: var(--text-muted);">No videos found</td></tr>';
                
                // Load thumbnails for visible video cards
                setTimeout(() => loadVideoThumbnails(), 100);
                
            } catch (err) {
                console.error('Error loading videos tab:', err);
                showToast('Error loading videos', 'error');
            }
        }
        
        function onVideosBrandFilterChange() {
            const brand = document.getElementById('videosBrandFilter').value;
            loadVideoProductsFromData(brand);
            loadVideosTab();
        }
        
        // Load product names directly from video_performance data
        async function loadVideoProductsFromData(brand) {
            const select = document.getElementById('videosProductFilter');
            if (!select) return;
            
            select.innerHTML = '<option value="all">All Products</option>';
            
            try {
                // First, load product groups for this brand
                let groupsData = [];
                try {
                    let groupQuery = supabaseClient.from('product_groups')
                        .select('*')
                        .eq('status', 'active');
                    
                    if (brand !== 'all') {
                        groupQuery = groupQuery.eq('brand', brand);
                    }
                    
                    const { data: groups, error: groupError } = await groupQuery;
                    if (!groupError && groups && groups.length > 0) {
                        groupsData = groups;
                    }
                } catch (e) {
                    // Table might not exist yet
                    console.log('Product groups not available');
                }
                
                // Add groups section if we have any
                if (groupsData.length > 0) {
                    const groupOptgroup = document.createElement('optgroup');
                    groupOptgroup.label = '📁 GROUPS';
                    
                    groupsData.forEach(g => {
                        const option = document.createElement('option');
                        option.value = 'group:' + g.id;
                        option.textContent = `${g.display_name} (${(g.product_names || []).length})`;
                        option.dataset.productNames = JSON.stringify(g.product_names || []);
                        groupOptgroup.appendChild(option);
                    });
                    
                    select.appendChild(groupOptgroup);
                }
                
                // Query distinct product names from video_performance
                let query = supabaseClient.from('video_performance')
                    .select('product_name')
                    .not('product_name', 'is', null);
                
                if (brand !== 'all') {
                    query = query.eq('brand', brand);
                }
                
                const { data, error } = await query;
                if (error) throw error;
                
                // Get unique product names
                const productNames = [...new Set((data || []).map(r => r.product_name).filter(n => n && n.trim()))];
                productNames.sort();
                
                // Add products section
                if (productNames.length > 0) {
                    const productOptgroup = document.createElement('optgroup');
                    productOptgroup.label = '📦 PRODUCTS';
                    
                    productNames.forEach(name => {
                        const option = document.createElement('option');
                        option.value = 'product:' + name;
                        option.textContent = name.length > 50 ? name.substring(0, 50) + '...' : name;
                        option.title = name;
                        productOptgroup.appendChild(option);
                    });
                    
                    select.appendChild(productOptgroup);
                }
                
                // Store groups for filter reference
                window.videoProductGroups = groupsData;
                
            } catch (err) {
                console.error('Error loading video products:', err);
            }
        }
        
        // Helper to get product names for filtering based on selection
        function getProductNamesForFilter(filterValue) {
            if (!filterValue || filterValue === 'all') {
                return null; // No filter
            }
            
            if (filterValue.startsWith('group:')) {
                const groupId = filterValue.replace('group:', '');
                const group = (window.videoProductGroups || []).find(g => g.id === groupId);
                return group ? group.product_names : [];
            }
            
            if (filterValue.startsWith('product:')) {
                return [filterValue.replace('product:', '')];
            }
            
            // Legacy: just a product name
            return [filterValue];
        }
        
        // ==================== CREATORS TAB ====================
        let creatorsTabData = [];
        let creatorsTabCategories = { attention: [], top: [], roi: [], all: [] };
        
        // Toggle creator section visibility
        function toggleCreatorSection(section) {
            const content = document.getElementById(section + 'Content');
            const toggle = document.getElementById(section + 'Toggle');
            if (!content || !toggle) return;
            
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            toggle.textContent = isHidden ? '▼' : '▶';
            
            // Update header border radius
            const header = content.previousElementSibling;
            if (header) {
                header.style.borderRadius = isHidden ? '12px 12px 0 0' : '12px';
            }
        }
        
        // Scroll to creator section
        function scrollToCreatorSection(section) {
            const el = document.getElementById('creatorSection' + section.charAt(0).toUpperCase() + section.slice(1));
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                const content = document.getElementById(section + 'Content');
                if (content && content.style.display === 'none') {
                    toggleCreatorSection(section);
                }
            }
        }
        
        // Helper: Check if creator has any retainer (overall OR product-specific)
        function hasAnyRetainer(creator) {
            if ((creator.retainer || 0) > 0) return true;
            const productRetainers = creator.product_retainers || {};
            return Object.values(productRetainers).some(r => (r || 0) > 0);
        }
        
        // Helper: Check if creator is assigned to any products (includes affiliates)
        function hasAnyProductAssignment(creator) {
            const productRetainers = creator.product_retainers || {};
            return Object.keys(productRetainers).length > 0;
        }
        
        // Helper: Get product assignment pills HTML
        function getProductAssignmentPills(creator, maxShow = 2) {
            const productRetainers = creator.product_retainers || {};
            const keys = Object.keys(productRetainers);
            if (keys.length === 0) return '';
            
            const pills = keys.slice(0, maxShow).map(key => {
                const value = productRetainers[key];
                let style = '';
                let text = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).substring(0, 12);
                
                if (value === 0) {
                    // Affiliate
                    style = 'background: var(--blue-dim); color: var(--blue);';
                    text += ' (A)';
                } else if (value === null || value === undefined) {
                    // Not set - warning
                    style = 'background: var(--danger-dim); color: var(--danger);';
                    text = '⚠️ ' + text;
                } else {
                    // Has retainer
                    style = 'background: var(--success-dim); color: var(--success);';
                }
                
                return `<span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; ${style}">${text}</span>`;
            }).join(' ');
            
            const more = keys.length > maxShow ? `<span style="font-size: 0.65rem; color: var(--text-muted);">+${keys.length - maxShow}</span>` : '';
            
            return pills + more;
        }
        
        // Helper: Get total retainer (brand + all products)
        function getTotalRetainer(creator) {
            let total = creator.retainer || 0;
            const productRetainers = creator.product_retainers || {};
            Object.values(productRetainers).forEach(r => total += (r || 0));
            return total;
        }
        
        // Helper: Get retainer breakdown display HTML
        function getRetainerBreakdownHtml(creator) {
            const baseRetainer = creator.retainer || 0;
            const productRetainers = creator.product_retainers || {};
            const productRetainerEntries = Object.entries(productRetainers).filter(([k, v]) => v && v > 0);
            const totalRetainer = getTotalRetainer(creator);
            
            if (baseRetainer > 0 || productRetainerEntries.length > 0) {
                const parts = [];
                if (baseRetainer > 0) {
                    parts.push(`<span style="color: var(--success);">💵 ${fmtMoney(baseRetainer)} base</span>`);
                }
                productRetainerEntries.forEach(([key, value]) => {
                    const displayName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    parts.push(`<span style="color: #8b5cf6;">📦 ${fmtMoney(value)} ${displayName}</span>`);
                });
                let html = parts.join(' + ');
                if (parts.length > 1) {
                    html += ` <span style="color: var(--text-muted); font-size: 0.75rem;">= ${fmtMoney(totalRetainer)}/mo</span>`;
                } else {
                    html += '<span style="color: var(--text-muted); font-size: 0.75rem;">/mo</span>';
                }
                return html;
            } else if (baseRetainer === 0 || Object.values(productRetainers).some(v => v === 0)) {
                return '<span class="badge" style="background: var(--blue-dim); color: var(--blue); font-size: 0.7rem;">Affiliate</span>';
            }
            return '';
        }
        
        // Render a creator management card
        function renderCreatorMgmtCard(c, badge = null) {
            if (!c) return '';  // Safety check
            const accounts = Array.isArray(c.accounts) ? c.accounts : [];
            const accountLinks = accounts.slice(0, 3).map(a => 
                `<a href="https://tiktok.com/@${a}" target="_blank" style="color: var(--accent); text-decoration: none; font-size: 0.8rem;">@${sanitize(a)}</a>`
            ).join(', ');
            const moreAccounts = accounts.length > 3 ? ` +${accounts.length - 3}` : '';
            
            const totalRetainer = getTotalRetainer(c);
            const roi = totalRetainer > 0 ? (c.gmv / totalRetainer) : null;
            const roiDisplay = roi !== null ? roi.toFixed(1) + 'x' : '-';
            const roiColor = roi === null ? 'var(--text-muted)' : roi >= 3 ? 'var(--success)' : roi >= 1 ? 'var(--warning)' : 'var(--error)';
            
            const statusColors = {
                'Active': 'var(--success)',
                'On Hold': 'var(--warning)',
                'Churned': 'var(--danger)'
            };
            const status = c.status || 'Active';
            const brandColor = BRAND_COLORS[c.brand] || '#666';
            
            return `
                <div class="creator-card" style="background: var(--bg-secondary); border-radius: 12px; padding: 16px; border: 1px solid var(--border); position: relative; transition: transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.2)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
                    <!-- Badge -->
                    ${badge ? `<div style="position: absolute; top: -8px; right: 12px; background: ${badge.bg}; color: ${badge.color}; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">${badge.text}</div>` : ''}
                    
                    <!-- Header: Name + Status -->
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                        <div style="flex: 1; min-width: 0;">
                            <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${sanitize(c.displayName || c.account_1 || 'Unknown')}
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                                ${accountLinks}${moreAccounts ? `<span style="color: var(--text-muted);"> ${moreAccounts}</span>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 4px; flex-shrink: 0;">
                            <span style="background: ${statusColors[status]}; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 600;">${status}</span>
                        </div>
                    </div>
                    
                    <!-- Stats Grid -->
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px;">
                        <div style="text-align: center; padding: 8px; background: var(--bg-card); border-radius: 8px;">
                            <div style="font-size: 1.1rem; font-weight: 700; color: var(--success);">$${(c.gmv || 0).toLocaleString()}</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted);">GMV</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background: var(--bg-card); border-radius: 8px;">
                            <div style="font-size: 1.1rem; font-weight: 700; color: var(--blue);">${totalRetainer ? '$' + totalRetainer.toLocaleString() : '-'}</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted);">Retainer</div>
                        </div>
                        <div style="text-align: center; padding: 8px; background: var(--bg-card); border-radius: 8px;">
                            <div style="font-size: 1.1rem; font-weight: 700; color: ${roiColor};">${roiDisplay}</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted);">ROI</div>
                        </div>
                    </div>
                    
                    <!-- Footer: Brand + Videos + Actions -->
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="background: ${brandColor}20; color: ${brandColor}; padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 600;">${formatBrandName(c.brand)}</span>
                            <span style="font-size: 0.75rem; color: var(--text-muted);">📹 ${c.videos || 0} videos</span>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button onclick="editCreator(${c.id})" class="btn btn-small" style="padding: 4px 8px; font-size: 0.7rem;">Edit</button>
                            ${accounts[0] ? `<a href="https://tiktok.com/@${accounts[0]}" target="_blank" class="btn btn-small" style="padding: 4px 8px; font-size: 0.7rem;">TikTok</a>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        
        async function loadCreatorsTab() {
            const brand = document.getElementById('creatorsBrandFilter')?.value || 'all';
            const product = document.getElementById('creatorsProductFilter')?.value || 'all';
            const statusFilter = document.getElementById('creatorsStatusFilter')?.value || 'active';
            
            // Get date range from Ops Center date picker
            const startStr = document.getElementById('opsDateFilterStart')?.value;
            const endStr = document.getElementById('opsDateFilterEnd')?.value;
            
            let startDate, endDate;
            if (startStr && endStr) {
                startDate = startStr;
                endDate = endStr;
            } else {
                const end = new Date();
                end.setDate(end.getDate() - 1);
                const start = new Date(end);
                start.setDate(start.getDate() - 29);
                startDate = localDateStr(start);
                endDate = localDateStr(end);
            }
            
            // Update context
            const startDisplay = new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endDisplay = new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            document.getElementById('creatorsTabContext').textContent = `${startDisplay} - ${endDisplay} • ${brand === 'all' ? 'All Brands' : BRAND_DISPLAY[brand]}`;
            
            try {
                // Get managed creators
                let query = supabaseClient.from('managed_creators')
                    .select('*')
                    .order('id', { ascending: true });
                
                if (brand !== 'all') {
                    query = query.eq('brand', brand);
                }
                
                const { data: creators, error } = await query;
                if (error) throw error;
                
                // Filter by status
                let filteredCreators = creators || [];
                if (statusFilter === 'active') {
                    filteredCreators = filteredCreators.filter(c => 
                        c.status !== 'Churned' && c.status !== 'On Hold'
                    );
                } else if (statusFilter !== 'all') {
                    filteredCreators = filteredCreators.filter(c => c.status === statusFilter);
                }
                
                // Filter by product if selected
                if (product !== 'all') {
                    filteredCreators = filteredCreators.filter(c => {
                        const assignments = c.product_assignments || [];
                        return assignments.includes(product);
                    });
                }
                
                // Get performance data for period
                const { data: perfData } = await supabaseClient.from('creator_performance')
                    .select('creator_name, brand, gmv, videos')
                    .gte('report_date', startDate)
                    .lte('report_date', endDate);
                
                // Aggregate performance by creator handle
                const perfMap = {};
                (perfData || []).forEach(p => {
                    const key = `${(p.creator_name || '').toLowerCase()}|${p.brand}`;
                    if (!perfMap[key]) perfMap[key] = { gmv: 0, videos: 0 };
                    perfMap[key].gmv += (p.gmv || 0);
                    perfMap[key].videos += (p.videos || 0);
                });
                
                // Process creators with performance data
                let totalRetainer = 0;
                let totalGmv = 0;
                
                creatorsTabData = filteredCreators.map(c => {
                    if (!c) return null;  // Safety check
                    const accounts = [c.account_1, c.account_2, c.account_3, c.account_4, c.account_5].filter(Boolean);
                    const creatorRetainer = getTotalRetainer(c);
                    totalRetainer += creatorRetainer;
                    
                    // Sum performance across all accounts
                    let gmv = 0;
                    let videos = 0;
                    accounts.forEach(acc => {
                        const key = `${acc.toLowerCase()}|${c.brand}`;
                        const perf = perfMap[key];
                        if (perf) {
                            gmv += perf.gmv;
                            videos += perf.videos;
                        }
                    });
                    totalGmv += gmv;
                    
                    const roi = creatorRetainer > 0 ? gmv / creatorRetainer : null;
                    
                    return {
                        id: c.id,
                        brand: c.brand,
                        status: c.status,
                        real_name: c.real_name,
                        discord_name: c.discord_name,
                        account_1: c.account_1,
                        retainer: c.retainer,
                        product_retainers: c.product_retainers,
                        product_assignments: c.product_assignments,
                        gmv,
                        videos,
                        accounts,
                        displayName: c.real_name || c.discord_name || c.account_1,
                        totalRetainer: creatorRetainer,
                        roi
                    };
                }).filter(Boolean);
                
                // Categorize creators
                
                // Needs Attention: On retainer but ROI < 1x (or no GMV)
                const attentionCreators = creatorsTabData
                    .filter(c => hasAnyRetainer(c) && (c.roi === null || c.roi < 1) && c.status !== 'Churned' && c.status !== 'On Hold')
                    .sort((a, b) => (b.totalRetainer || 0) - (a.totalRetainer || 0));
                
                // Top Performers: Highest GMV
                const topPerformers = creatorsTabData
                    .filter(c => (c.gmv || 0) > 0)
                    .sort((a, b) => (b.gmv || 0) - (a.gmv || 0))
                    .slice(0, 15);
                
                // ROI Leaders: Best ROI among retainer creators
                const roiLeaders = creatorsTabData
                    .filter(c => hasAnyRetainer(c) && c.roi !== null && c.roi >= 1)
                    .sort((a, b) => (b.roi || 0) - (a.roi || 0))
                    .slice(0, 15);
                
                creatorsTabCategories = {
                    attention: attentionCreators,
                    top: topPerformers,
                    roi: roiLeaders,
                    all: creatorsTabData
                };
                
                // Update stats
                document.getElementById('creatorsStatAttention').textContent = attentionCreators.length;
                document.getElementById('creatorsStatTop').textContent = Math.min(topPerformers.length, 10);
                document.getElementById('creatorsStatTotal').textContent = creatorsTabData.length.toLocaleString();
                document.getElementById('creatorsStatRetainer').textContent = '$' + totalRetainer.toLocaleString();
                document.getElementById('creatorsStatGmv').textContent = '$' + totalGmv.toLocaleString(undefined, {maximumFractionDigits: 0});
                
                // Update counts
                document.getElementById('creatorsAttentionCount').textContent = attentionCreators.length;
                document.getElementById('creatorsTopCount').textContent = topPerformers.length;
                document.getElementById('creatorsRoiCount').textContent = roiLeaders.length;
                document.getElementById('creatorsAllCount').textContent = creatorsTabData.length;
                
                // Render Attention section
                const attentionGrid = document.getElementById('creatorsAttentionGrid');
                if (attentionCreators.length === 0) {
                    attentionGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">✅ All retainer creators are delivering ROI!</div>';
                } else {
                    attentionGrid.innerHTML = attentionCreators.slice(0, 12).map(c => 
                        renderCreatorMgmtCard(c, { text: '⚠️ LOW ROI', bg: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white' })
                    ).join('');
                }
                
                // Render Top Performers section
                const topGrid = document.getElementById('creatorsTopGrid');
                if (topPerformers.length === 0) {
                    topGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">📊 No performance data for this period</div>';
                } else {
                    topGrid.innerHTML = topPerformers.slice(0, 12).map((c, i) => 
                        renderCreatorMgmtCard(c, i < 3 ? { text: `#${i+1}`, bg: 'linear-gradient(135deg, #22c55e, #16a34a)', color: 'white' } : null)
                    ).join('');
                }
                
                // Render ROI Leaders section
                const roiGrid = document.getElementById('creatorsRoiGrid');
                if (roiLeaders.length === 0) {
                    roiGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">📊 No retainer creators with positive ROI yet</div>';
                } else {
                    roiGrid.innerHTML = roiLeaders.slice(0, 12).map((c, i) => 
                        renderCreatorMgmtCard(c, { text: `${c.roi.toFixed(1)}x ROI`, bg: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white' })
                    ).join('');
                }
                
                // Render table
                filterCreatorsTable();
                
            } catch (err) {
                console.error('Error loading creators tab:', err);
                showToast('Error loading creators', 'error');
            }
        }
        
        function filterCreatorsTable() {
            const search = document.getElementById('creatorsSearchFilter')?.value?.toLowerCase() || '';
            
            let filtered = creatorsTabData;
            if (search) {
                filtered = filtered.filter(c => 
                    (c.displayName || '').toLowerCase().includes(search) ||
                    (c.real_name || '').toLowerCase().includes(search) ||
                    (c.discord_name || '').toLowerCase().includes(search) ||
                    (c.accounts || []).some(a => a.toLowerCase().includes(search))
                );
            }
            
            // Sort by GMV descending
            filtered = filtered.sort((a, b) => (b.gmv || 0) - (a.gmv || 0));
            
            document.getElementById('creatorsTableBody').innerHTML = filtered.map(c => {
                const accounts = c.accounts || [];
                const accountLinks = accounts.length > 0 
                    ? accounts.slice(0, 2).map(a => `<a href="https://tiktok.com/@${a}" target="_blank" style="color: var(--accent); text-decoration: none; font-size: 0.85rem;">@${sanitize(a)}</a>`).join(', ') + (accounts.length > 2 ? ` <span style="color: var(--text-muted);">+${accounts.length - 2}</span>` : '')
                    : `<span style="color: var(--text-muted);">-</span>`;
                
                const isRetainer = hasAnyRetainer(c);
                const typeBadge = isRetainer 
                    ? `<span class="badge" style="background: var(--success); color: white; font-size: 0.65rem;">💰 Retainer</span>`
                    : `<span class="badge" style="background: var(--blue); color: white; font-size: 0.65rem;">🔗 Affiliate</span>`;
                
                const status = c.status || 'Active';
                const statusColors = {
                    'Active': 'var(--success)',
                    'On Hold': 'var(--warning)',
                    'Churned': 'var(--danger)'
                };
                const statusBadge = `<span class="badge" style="background: ${statusColors[status] || 'var(--text-muted)'}; color: white; font-size: 0.6rem;">${status}</span>`;
                
                const totalRetainer = getTotalRetainer(c);
                const roi = totalRetainer > 0 ? (c.gmv / totalRetainer) : null;
                const roiDisplay = roi !== null ? roi.toFixed(1) + 'x' : '-';
                const roiColor = roi === null ? 'var(--text-muted)' : roi >= 3 ? 'var(--success)' : roi >= 1 ? 'var(--warning)' : 'var(--error)';
                
                return `
                    <tr>
                        <td>
                            <div style="font-weight: 600;">${sanitize(c.displayName || c.account_1 || 'Unknown')}</div>
                            ${c.real_name && c.discord_name ? `<div style="font-size: 0.7rem; color: var(--text-muted);">${sanitize(c.discord_name)}</div>` : ''}
                        </td>
                        <td style="text-align: center;">${statusBadge}</td>
                        <td style="text-align: center;">${typeBadge}</td>
                        <td style="font-size: 0.85rem;">${accountLinks}</td>
                        <td><span class="badge" style="font-size: 0.65rem;">${formatBrandName(c.brand)}</span></td>
                        <td style="text-align: center;">${totalRetainer ? '$' + totalRetainer.toLocaleString() : '<span style="color: var(--text-muted);">-</span>'}</td>
                        <td style="text-align: right; font-weight: 600; color: var(--success);">$${(c.gmv || 0).toLocaleString()}</td>
                        <td style="text-align: center; font-weight: 600; color: ${roiColor};">${roiDisplay}</td>
                        <td style="text-align: center;">${c.videos || 0}</td>
                        <td style="text-align: center;">
                            <button class="btn btn-small" onclick="editCreator(${c.id})" style="padding: 4px 8px; font-size: 0.7rem;">Edit</button>
                        </td>
                    </tr>
                `;
            }).join('') || '<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--text-muted);">No creators found</td></tr>';
        }
        
        function exportCreatorsCSV() {
            const data = creatorsTabData;
            if (data.length === 0) {
                showToast('No creators to export', 'warning');
                return;
            }
            
            const headers = ['Name', 'Real Name', 'Discord', 'Status', 'Type', 'Brand', 'Accounts', 'Retainer', 'GMV', 'ROI', 'Videos'];
            const rows = data.map(c => [
                c.displayName || '',
                c.real_name || '',
                c.discord_name || '',
                c.status || 'Active',
                hasAnyRetainer(c) ? 'Retainer' : 'Affiliate',
                formatBrandName(c.brand),
                (c.accounts || []).join('; '),
                getTotalRetainer(c),
                c.gmv || 0,
                c.roi ? c.roi.toFixed(2) : '',
                c.videos || 0
            ]);
            
            const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `creators_export_${localDateStr(new Date())}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('CSV exported!', 'success');
        }
        
        function onCreatorsBrandFilterChange() {
            loadProductsForFilter('creatorsProductFilter', document.getElementById('creatorsBrandFilter').value);
            loadCreatorsTab();
        }
        
        // ==================== POSTING TAB BRAND FILTER ====================
        function onPostingBrandFilterChange() {
            // Reload data with new brand filter
            loadPostingData();
        }
        
