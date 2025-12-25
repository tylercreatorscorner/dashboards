// ==================== OPS CENTER V2 - OPTIMIZED ====================
// Features: List View, Pagination, Shared Data Cache, Virtual Scrolling

// ==================== SHARED DATA CACHE ====================
const OpsCache = {
    managedCreators: null,
    creatorPerformance: null,
    videoPerformance: null,
    lastFetch: {},
    cacheDuration: 5 * 60 * 1000, // 5 minutes
    
    // Check if cache is valid
    isValid(key) {
        return this[key] && this.lastFetch[key] && 
               (Date.now() - this.lastFetch[key]) < this.cacheDuration;
    },
    
    // Get managed creators (cached)
    async getManagedCreators(forceRefresh = false) {
        if (!forceRefresh && this.isValid('managedCreators')) {
            return this.managedCreators;
        }
        
        const { data, error } = await supabaseClient
            .from('managed_creators')
            .select('*')
            .eq('status', 'Active');
        
        if (error) throw error;
        
        this.managedCreators = data || [];
        this.lastFetch.managedCreators = Date.now();
        
        // Also update global managedCreators for backward compatibility
        window.managedCreators = this.managedCreators;
        
        return this.managedCreators;
    },
    
    // Invalidate cache (call after updates)
    invalidate(key = null) {
        if (key) {
            this[key] = null;
            this.lastFetch[key] = null;
        } else {
            this.managedCreators = null;
            this.creatorPerformance = null;
            this.videoPerformance = null;
            this.lastFetch = {};
        }
    }
};

// ==================== VIEW STATE ====================
const OpsViewState = {
    currentView: localStorage.getItem('opsViewMode') || 'card', // 'card' or 'list'
    pageSize: 50,
    currentPage: {},  // { ghosts: 1, behind: 1, ... }
    expandedSections: { ghosts: true, behind: true, atrisk: true, ontrack: false, stars: false },
    
    setView(view) {
        this.currentView = view;
        localStorage.setItem('opsViewMode', view);
    },
    
    resetPages() {
        this.currentPage = { ghosts: 1, behind: 1, atrisk: 1, ontrack: 1, stars: 1 };
    }
};

// ==================== VIEW TOGGLE ====================
function renderViewToggle(containerId = 'postingViewToggle') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = `
        <div class="ops-view-toggle">
            <button onclick="switchOpsView('card')" class="${OpsViewState.currentView === 'card' ? 'active' : ''}" title="Card View">
                ▦ Cards
            </button>
            <button onclick="switchOpsView('list')" class="${OpsViewState.currentView === 'list' ? 'active' : ''}" title="List View">
                ☰ List
            </button>
        </div>
    `;
}

function switchOpsView(view) {
    OpsViewState.setView(view);
    OpsViewState.resetPages();
    renderViewToggle();
    renderPostingCards(); // Re-render with new view
}

// ==================== LIST VIEW RENDERING - POLISHED ====================
function renderPostingListView(sectionName, creators, accentColor) {
    const container = document.getElementById(`posting${sectionName}Grid`);
    if (!container) return;
    
    // Get paginated subset
    const page = OpsViewState.currentPage[sectionName.toLowerCase()] || 1;
    const pageSize = OpsViewState.pageSize;
    const startIdx = 0;
    const endIdx = page * pageSize;
    const visibleCreators = creators.slice(startIdx, endIdx);
    const hasMore = creators.length > endIdx;
    
    if (creators.length === 0) {
        container.innerHTML = `<div class="ops-empty"><div class="ops-empty-icon">✅</div>No creators in this category</div>`;
        return;
    }
    
    const statusClass = sectionName.toLowerCase();
    
    container.innerHTML = `
        <div class="ops-list-container">
            <div class="ops-list-header">
                <div>Creator</div>
                <div>Retainer</div>
                <div style="justify-content: center;">Posts</div>
                <div style="justify-content: flex-end;">GMV</div>
                <div style="justify-content: center;">ROI</div>
                <div>Last Contact</div>
                <div style="justify-content: flex-end;">Actions</div>
            </div>
            <div class="ops-list-body">
                ${visibleCreators.map(c => renderListRowPolished(c, statusClass)).join('')}
            </div>
            <div class="ops-pagination">
                <span class="ops-page-info">Showing ${visibleCreators.length} of ${creators.length}</span>
                ${hasMore ? `
                    <button class="ops-load-more" onclick="loadMorePosting('${sectionName.toLowerCase()}')">
                        Load More (${Math.min(pageSize, creators.length - endIdx)} more)
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function renderListRowPolished(c, statusClass) {
    // Recently contacted check
    const today = new Date().toISOString().split('T')[0];
    const isContactedToday = c.lastContact === today;
    const contactedClass = isContactedToday ? 'contacted' : '';
    
    // Retainer display
    const retainerDisplay = c.isRetainer && c.retainer > 0 
        ? `<span class="ops-list-retainer">${fmtMoney(c.retainer)}</span>`
        : `<span class="ops-list-retainer none">—</span>`;
    
    // ROI calculation and styling
    const roi = c.roi || 0;
    let roiClass = 'na';
    let roiDisplay = '—';
    if (c.isRetainer && c.retainer > 0) {
        if (roi >= 5) roiClass = 'excellent';
        else if (roi >= 2) roiClass = 'good';
        else if (roi >= 1) roiClass = 'ok';
        else roiClass = 'bad';
        roiDisplay = `${roi.toFixed(1)}x`;
    }
    
    // GMV display
    const gmv = c.gmv || 0;
    const gmvClass = gmv === 0 ? 'zero' : '';
    
    // Contact display
    let contactDisplay = 'Never';
    let contactClass = 'never';
    if (c.lastContact) {
        const contactDate = new Date(c.lastContact);
        const daysSince = Math.floor((new Date() - contactDate) / (1000 * 60 * 60 * 24));
        if (daysSince === 0) {
            contactDisplay = 'Today';
            contactClass = 'today';
        } else if (daysSince === 1) {
            contactDisplay = 'Yesterday';
            contactClass = 'recent';
        } else if (daysSince <= 3) {
            contactDisplay = `${daysSince}d ago`;
            contactClass = 'recent';
        } else if (daysSince <= 7) {
            contactDisplay = `${daysSince}d ago`;
            contactClass = 'stale';
        } else {
            contactDisplay = `${daysSince}d ago`;
            contactClass = 'old';
        }
    }
    
    // Brand badge
    const brandColors = {
        'physicians_choice': '#22c55e',
        'catakor': '#f59e0b', 
        'jiyu': '#3b82f6',
        'peach_slices': '#ec4899',
        'yerba_magic': '#8b5cf6'
    };
    const brandColor = brandColors[c.brand] || 'var(--accent)';
    const brandDisplay = BRAND_DISPLAY[c.brand] || c.brand;
    
    // Fiber badge
    const isPCFiber = c.brand === 'physicians_choice' && c.productRetainers && c.productRetainers['pc_fiber'] > 0;
    const fiberBadge = isPCFiber ? `<span class="ops-badge ops-badge-fiber">FIBER</span>` : '';
    
    // Discord button
    const discordBtn = c.discordChannelId 
        ? `<button onclick="openDiscordChannel('${c.brand}', '${c.discordChannelId}')" class="btn btn-discord" title="Open Discord">💬</button>`
        : '';
    
    // Mini chart
    const miniChart = renderMiniChartPolished(c.dailyPosts);
    
    return `
        <div class="ops-list-row ${contactedClass}" data-status="${statusClass}">
            <div class="ops-list-creator">
                <div class="ops-list-avatar">${(c.name || '?')[0].toUpperCase()}</div>
                <div class="ops-list-info">
                    <div class="ops-list-name">${sanitize(c.name)}</div>
                    <div class="ops-list-meta">
                        <a href="https://tiktok.com/@${c.handle}" target="_blank" class="ops-list-handle">@${c.handle}</a>
                        <span class="ops-badge" style="background: ${brandColor}20; color: ${brandColor}; font-size: 0.6rem;">${brandDisplay}</span>
                        ${fiberBadge}
                    </div>
                </div>
            </div>
            <div>${retainerDisplay}</div>
            <div class="ops-list-posts">
                <span class="ops-list-posts-num ${statusClass}">${c.posts7d || 0}</span>
                ${miniChart}
            </div>
            <div class="ops-list-gmv ${gmvClass}">${fmtMoney(gmv)}</div>
            <div class="ops-list-roi ${roiClass}">${roiDisplay}</div>
            <div class="ops-list-contact ${contactClass}">${contactDisplay}</div>
            <div class="ops-list-actions">
                <button onclick="quickMarkContacted('${c.handle?.toLowerCase()}', '${c.brand}')" class="btn btn-success" title="Mark contacted">✓</button>
                <button onclick="markContacted('${c.handle?.toLowerCase()}|${c.brand}')" class="btn" title="Log details">📝</button>
                ${discordBtn}
            </div>
        </div>
    `;
}

function renderMiniChartPolished(dailyPosts) {
    // Get last 7 days
    const dates = [];
    for (let i = 7; i >= 1; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }
    
    if (!dailyPosts || Object.keys(dailyPosts).length === 0) {
        const emptyBars = dates.map(() => `<div class="ops-mini-bar" style="height: 2px;"></div>`).join('');
        return `<div class="ops-mini-chart">${emptyBars}</div>`;
    }
    
    const maxVal = Math.max(...Object.values(dailyPosts), 1);
    
    const bars = dates.map(date => {
        const count = dailyPosts[date] || 0;
        const height = count > 0 ? Math.max(3, Math.round((count / maxVal) * 14)) : 2;
        const barClass = count >= 5 ? 'burst' : count > 0 ? 'active' : '';
        return `<div class="ops-mini-bar ${barClass}" style="height: ${height}px;" title="${date}: ${count} posts"></div>`;
    }).join('');
    
    return `<div class="ops-mini-chart">${bars}</div>`;
}

// ==================== CARD VIEW WITH PAGINATION ====================
function renderPostingCardView(sectionName, creators, accentColor) {
    const container = document.getElementById(`posting${sectionName}Grid`);
    if (!container) return;
    
    // Get paginated subset
    const page = OpsViewState.currentPage[sectionName.toLowerCase()] || 1;
    const pageSize = OpsViewState.pageSize;
    const endIdx = page * pageSize;
    const visibleCreators = creators.slice(0, endIdx);
    const hasMore = creators.length > endIdx;
    
    if (creators.length === 0) {
        container.innerHTML = `<div class="ops-empty"><div class="ops-empty-icon">✅</div>No creators in this category</div>`;
        return;
    }
    
    // Render cards using existing renderPostingCard function (for backward compatibility)
    let html = visibleCreators.map(c => renderPostingCard(c, accentColor, sectionName)).join('');
    
    // Add pagination
    if (hasMore) {
        html += `
            <div style="grid-column: 1 / -1;" class="ops-pagination">
                <span class="ops-page-info">Showing ${visibleCreators.length} of ${creators.length}</span>
                <button class="ops-load-more" onclick="loadMorePosting('${sectionName.toLowerCase()}')">
                    Load ${Math.min(pageSize, creators.length - endIdx)} More
                </button>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ==================== PAGINATION CONTROLS ====================
function loadMorePosting(section) {
    if (!OpsViewState.currentPage[section]) {
        OpsViewState.currentPage[section] = 1;
    }
    OpsViewState.currentPage[section]++;
    
    // Re-render just this section
    const sectionNameMap = {
        'ghosts': 'Ghosts',
        'behind': 'Behind',
        'atrisk': 'Atrisk',
        'ontrack': 'Ontrack',
        'stars': 'Stars'
    };
    const colorMap = {
        'ghosts': '#6b7280',
        'behind': '#ef4444',
        'atrisk': '#f59e0b',
        'ontrack': '#22c55e',
        'stars': '#8b5cf6'
    };
    
    const sectionName = sectionNameMap[section];
    const color = colorMap[section];
    const creators = postingCategories[section] || [];
    
    if (OpsViewState.currentView === 'list') {
        renderPostingListView(sectionName, creators, color);
    } else {
        renderPostingCardView(sectionName, creators, color);
    }
}

// ==================== VIRTUAL SCROLLING ====================
class VirtualScroller {
    constructor(container, itemHeight, renderItem) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.items = [];
        this.visibleStart = 0;
        this.visibleEnd = 0;
        this.buffer = 5; // Extra items above/below viewport
        
        this.init();
    }
    
    init() {
        this.container.classList.add('ops-virtual-container');
        this.container.innerHTML = `
            <div class="ops-virtual-spacer"></div>
            <div class="ops-virtual-content"></div>
        `;
        this.spacer = this.container.querySelector('.ops-virtual-spacer');
        this.content = this.container.querySelector('.ops-virtual-content');
        
        this.container.addEventListener('scroll', () => this.onScroll());
    }
    
    setItems(items) {
        this.items = items;
        this.spacer.style.height = `${items.length * this.itemHeight}px`;
        this.render();
    }
    
    onScroll() {
        this.render();
    }
    
    render() {
        const scrollTop = this.container.scrollTop;
        const viewportHeight = this.container.clientHeight;
        
        const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
        const end = Math.min(this.items.length, Math.ceil((scrollTop + viewportHeight) / this.itemHeight) + this.buffer);
        
        if (start === this.visibleStart && end === this.visibleEnd) return;
        
        this.visibleStart = start;
        this.visibleEnd = end;
        
        const visibleItems = this.items.slice(start, end);
        this.content.style.top = `${start * this.itemHeight}px`;
        this.content.innerHTML = visibleItems.map(this.renderItem).join('');
    }
}

// ==================== UPDATED RENDER FUNCTION ====================
// Override the existing renderPostingSection function
const originalRenderPostingSection = typeof renderPostingSection === 'function' ? renderPostingSection : null;

function renderPostingSectionV2(sectionName, creators, accentColor, emoji) {
    if (OpsViewState.currentView === 'list') {
        renderPostingListView(sectionName, creators, accentColor);
    } else {
        renderPostingCardView(sectionName, creators, accentColor);
    }
}

// ==================== INIT VIEW TOGGLE ON PAGE LOAD ====================
function initOpsViewToggle() {
    // Find the filter row in Posting tab and add view toggle
    const filterRow = document.querySelector('#ops-tab-posting .ops-section-actions, #ops-tab-posting [style*="display: flex"][style*="gap"]');
    
    if (filterRow) {
        // Check if toggle already exists
        if (!document.getElementById('postingViewToggle')) {
            const toggleDiv = document.createElement('div');
            toggleDiv.id = 'postingViewToggle';
            toggleDiv.style.marginLeft = '12px';
            filterRow.appendChild(toggleDiv);
            renderViewToggle();
        }
    }
    
    OpsViewState.resetPages();
}

// ==================== HOOK INTO EXISTING SYSTEM ====================
// Replace renderPostingCards to use our optimized version
const originalRenderPostingCards = typeof renderPostingCards === 'function' ? renderPostingCards : null;

function renderPostingCardsV2() {
    // Ensure view toggle is rendered
    renderViewToggle();
    
    // Render each section with appropriate view
    const sections = [
        { name: 'Ghosts', data: postingCategories.ghosts || [], color: '#6b7280', emoji: '👻' },
        { name: 'Behind', data: postingCategories.behind || [], color: '#ef4444', emoji: '🚨' },
        { name: 'Atrisk', data: postingCategories.atrisk || [], color: '#f59e0b', emoji: '⚠️' },
        { name: 'Ontrack', data: postingCategories.ontrack || [], color: '#22c55e', emoji: '✅' },
        { name: 'Stars', data: postingCategories.stars || [], color: '#8b5cf6', emoji: '⭐' }
    ];
    
    sections.forEach(section => {
        renderPostingSectionV2(section.name, section.data, section.color, section.emoji);
    });
}

// Override global function
if (typeof window !== 'undefined') {
    window.renderPostingCards = renderPostingCardsV2;
    window.loadMorePosting = loadMorePosting;
    window.switchOpsView = switchOpsView;
    window.OpsCache = OpsCache;
    window.OpsViewState = OpsViewState;
    
    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOpsViewToggle);
    } else {
        // Small delay to ensure other scripts have loaded
        setTimeout(initOpsViewToggle, 100);
    }
}

// ==================== EXPORT FOR MODULE USE ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OpsCache,
        OpsViewState,
        VirtualScroller,
        renderPostingListView,
        renderPostingCardView,
        loadMorePosting
    };
}
