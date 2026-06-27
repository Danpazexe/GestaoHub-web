import { useMemo, useState, useEffect } from 'react';
import { navGroups, navItems } from '../config/navigation';
import { AppIcon } from './AppIcon';
import { GlobalSearch } from './GlobalSearch';

export const AdminShell = ({
  profile,
  admin,
  selectedView,
  onSelectView,
  onRefresh,
  onSignOut,
  lastRefresh,
  searchData,
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({ general: true, operation: true });
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('gh-theme') || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
    try { localStorage.setItem('gh-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  const activeItem = useMemo(
    () => navItems.find((item) => item.key === selectedView) || navItems[0],
    [selectedView],
  );

  const toggleGroup = (groupKey) => {
    setOpenGroups((cur) => ({ ...cur, [groupKey]: !cur[groupKey] }));
  };

  const handleSelectView = (key) => {
    onSelectView(key);
    setMobileOpen(false);
  };

  // close sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => { if (window.innerWidth > 768) setMobileOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarClass = [
    'sidebar',
    sidebarCollapsed ? 'compact' : '',
    mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  const initials = (profile?.name || profile?.email || 'AD').slice(0, 2).toUpperCase();
  const displayName = profile?.name || profile?.email || 'Admin';

  return (
    <div className="app-shell">
      {/* Mobile overlay */}
      <div
        className={mobileOpen ? 'sidebar-overlay open' : 'sidebar-overlay'}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside className={sidebarClass}>
        <div className="sidebar-brand">
          <div className="brand-logo-row">
            <div className="brand-mark" aria-hidden="true">GH</div>
            <div className="brand-text">
              <strong>GestãoHub</strong>
              <span>Admin Control</span>
            </div>
          </div>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        <nav aria-label="Navegação principal">
          {sidebarCollapsed
            ? navItems.map((item) => (
                <button
                  key={item.key}
                  className={item.key === selectedView ? 'nav-item compact active' : 'nav-item compact'}
                  onClick={() => handleSelectView(item.key)}
                  title={item.label}
                >
                  <AppIcon name={item.icon} size={17} className="nav-icon" />
                  <span className="compact-label">{item.shortLabel || item.label.slice(0, 2)}</span>
                </button>
              ))
            : navGroups.map((group) => (
                <div className="nav-group" key={group.key}>
                  <div className="nav-section-label">{group.label}</div>
                  <div className="nav-group-items">
                    {group.items.map((item) => (
                      <button
                        key={item.key}
                        className={item.key === selectedView ? 'nav-item active' : 'nav-item'}
                        onClick={() => handleSelectView(item.key)}
                      >
                        <AppIcon name={item.icon} size={16} className="nav-icon" />
                        <span className="nav-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
        </nav>

        <div className="sidebar-profile">
          <div className="profile-avatar" aria-hidden="true">{initials}</div>
          <div className="profile-info">
            <span className="profile-name">{displayName}</span>
            <span className="profile-email">{profile?.email || '-'}</span>
            <span className="profile-role">{admin?.role || 'admin'}</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-shell">
        <div className="main-shell-inner">
          {/* Mobile topbar */}
          <div className="mobile-topbar">
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="mobile-brand">
              <div className="brand-mark" aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, fontSize: 10 }}>GH</div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>GestãoHub</span>
            </div>
            <div style={{ width: 36 }} />
          </div>

          {/* Desktop topbar */}
          <header className="topbar" role="banner">
            <div className="topbar-left">
              <span className="topbar-eyebrow">Operação em tempo real</span>
              <h1 className="topbar-title">Painel administrativo</h1>
              <p className="topbar-subtitle">{activeItem.label}</p>
            </div>
            <div className="topbar-search">
              <GlobalSearch data={searchData} onNavigate={onSelectView} />
            </div>
            <div className="topbar-right">
              <button
                className="ghost-button theme-toggle"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
                aria-label="Alternar tema"
              >
                {theme === 'dark' ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
              </button>
              <span className="topbar-refresh-note">Atualizado: {lastRefresh}</span>
              <span className="live-badge" aria-label="Sistema operacional">Ao vivo</span>
              <button
                className="ghost-button"
                onClick={() => onSelectView('tv')}
                title="Abrir modo TV (painel em tela cheia)"
                aria-label="Modo TV"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" />
                </svg>
                TV
              </button>
              <button className="ghost-button" onClick={onRefresh} title="Atualizar dados">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                Atualizar
              </button>
              <button className="danger-button" onClick={onSignOut} title="Sair do painel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sair
              </button>
            </div>
          </header>

          <div className="dashboard-content">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};
