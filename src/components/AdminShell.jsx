import { useMemo, useState, useEffect } from 'react';
import { navGroups, navItems } from '../config/navigation';
import { AppIcon } from './AppIcon';
import { GlobalSearch } from './GlobalSearch';
import { NotificationsBell } from './NotificationsBell';

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
  const [account, setAccount] = useState(null); // null | 'top' | 'side'
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

  const handleSelectView = (key) => {
    onSelectView(key);
    setMobileOpen(false);
  };

  // fecha menu de conta ao clicar fora
  useEffect(() => {
    if (!account) return undefined;
    const onDown = (event) => {
      if (!event.target.closest('.account-trigger, .account-menu')) setAccount(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [account]);

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

  const close = () => setAccount(null);
  const accountMenu = (anchor) => (account === anchor ? (
    <div className="account-menu" role="menu">
      <div className="account-menu-head">
        <div className="account-avatar-lg" aria-hidden="true">{initials}</div>
        <div>
          <strong>{displayName}</strong>
          <span>{profile?.email || '-'}</span>
        </div>
      </div>
      <button type="button" className="account-menu-item" role="menuitem" onClick={() => { onRefresh?.(); close(); }}>
        <AppIcon name="recebimento" size={16} /> Atualizar dados
      </button>
      <button type="button" className="account-menu-item" role="menuitem" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
        <AppIcon name={theme === 'dark' ? 'overview' : 'validade'} size={16} /> {theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
      </button>
      <button type="button" className="account-menu-item" role="menuitem" onClick={() => { onSelectView('tv'); close(); }}>
        <AppIcon name="tv" size={16} /> Modo TV
      </button>
      <div className="account-menu-divider" />
      <button type="button" className="account-menu-item is-danger" role="menuitem" onClick={() => { onSignOut?.(); close(); }}>
        <AppIcon name="events" size={16} /> Sair
      </button>
      <div className="account-menu-foot">Dados atualizados: {lastRefresh}</div>
    </div>
  ) : null);

  return (
    <div className="app-shell">
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
              <span>Supervisão</span>
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
                  aria-label={item.label}
                >
                  <AppIcon name={item.icon} size={19} className="nav-icon" />
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
                        <AppIcon name={item.icon} size={17} className="nav-icon" />
                        <span className="nav-label">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
        </nav>

        {!sidebarCollapsed ? (
          <div className="sidebar-account">
            <button type="button" className="sidebar-profile account-trigger" onClick={() => setAccount((a) => (a === 'side' ? null : 'side'))}>
              <div className="profile-avatar" aria-hidden="true">{initials}</div>
              <div className="profile-info">
                <span className="profile-name">{displayName}</span>
                <span className="profile-role">{admin?.role || 'admin'}</span>
              </div>
              <span className="profile-caret" aria-hidden="true">⌄</span>
            </button>
            {accountMenu('side')}
          </div>
        ) : null}
      </aside>

      {/* Main */}
      <main className="main-shell">
        <div className="main-shell-inner">
          {/* Mobile topbar */}
          <div className="mobile-topbar">
            <button className="mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="Abrir menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div className="mobile-brand">
              <div className="brand-mark" aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 9, fontSize: 10 }}>GH</div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{activeItem.label}</span>
            </div>
            <div style={{ width: 36 }} />
          </div>

          {/* Desktop topbar */}
          <header className="topbar" role="banner">
            <div className="topbar-left">
              <h1 className="topbar-title">{activeItem.label}</h1>
            </div>
            <div className="topbar-search">
              <GlobalSearch data={searchData} onNavigate={onSelectView} />
            </div>
            <div className="topbar-right">
              <button className="icon-button" onClick={onRefresh} title="Atualizar dados" aria-label="Atualizar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
              <NotificationsBell data={searchData} onNavigate={onSelectView} />
              <div className="account">
                <button type="button" className="account-trigger account-avatar" onClick={() => setAccount((a) => (a === 'top' ? null : 'top'))} title="Conta" aria-label="Menu da conta">
                  {initials}
                </button>
                {accountMenu('top')}
              </div>
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
