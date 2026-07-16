import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, PencilLine, History, Package, Coffee, Menu, X, Store, Dumbbell, Users, DollarSign } from 'lucide-react';

const navGroups = [
  {
    label: '进销存',
    items: [
      { to: '/', icon: LayoutDashboard, label: '看板', end: true },
      { to: '/entry', icon: PencilLine, label: '录入', end: false },
      { to: '/history', icon: History, label: '对比', end: false },
      { to: '/products', icon: Package, label: '产品', end: false },
    ],
  },
  {
    label: '经销商',
    items: [
      { to: '/distributors', icon: Users, label: '经销商管理', end: false },
    ],
  },
  {
    label: '财务',
    items: [
      { to: '/expense', icon: DollarSign, label: '费用管理', end: false },
      { to: '/fridge', icon: Package, label: '冰箱管理', end: false },
    ],
  },
  {
    label: '业务拓展',
    items: [
      { to: '/supermarket', icon: Store, label: '商超系统', end: false },
      { to: '/billiard', icon: Dumbbell, label: '台球厅', end: false },
    ],
  },
];

const allNavItems = navGroups.flatMap((g) => g.items);

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = (isActive: boolean) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-starbucks-50 text-starbucks-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
    }`;

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {navGroups.map((group) => (
        <div key={group.label} className="mb-3 last:mb-0">
          <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{group.label}</div>
          {group.items.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={onClick} className={({ isActive }) => linkClass(isActive)}>
              <Icon size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-52 bg-white border-r border-gray-200 flex-col flex-shrink-0">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-100">
          <Coffee className="w-7 h-7 text-starbucks-500 flex-shrink-0" />
          <span className="font-bold text-sm text-gray-800 leading-tight">星巴克即饮<br/>进销存</span>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          <NavLinks />
        </nav>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Coffee className="w-5 h-5 text-starbucks-500" />
          <span className="font-bold text-sm text-gray-800">星巴克进销存</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 -mr-1 rounded-lg hover:bg-gray-100">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-20">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-14 left-0 right-0 bg-white border-b border-gray-200 shadow-lg p-3">
            <nav className="space-y-0.5">
              <NavLinks onClick={() => setMenuOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 flex items-center justify-around py-1 safe-bottom overflow-x-auto">
        {allNavItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-[10px] font-medium transition-colors whitespace-nowrap ${
                isActive ? 'text-starbucks-600' : 'text-gray-400'
              }`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
