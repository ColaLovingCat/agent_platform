import { useEffect, useState } from 'react';
import { RefreshCw, Search, Trash2, UserRound } from 'lucide-react';
import { listUsers, removeUser, saveUser } from '../api';
import { USER_ROLES, type User, type UserRole } from '../../shared/datas.type';

const EMPTY = { name: '', email: '', role: 'user' as UserRole };

export default function UserBoard() {
  const [users, setUsers] = useState<User[]>([]);
  const [keyword, setKeyword] = useState('');
  const [draft, setDraft] = useState(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load(q: string) {
    setLoading(true);
    setError('');
    try {
      const result = await listUsers(q);
      setUsers(result.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load('');
  }, []);

  function resetForm() {
    setDraft(EMPTY);
    setEditingId(null);
  }

  async function onSave() {
    setSaving(true);
    setError('');
    try {
      await saveUser({
        id: editingId ?? undefined,
        name: draft.name,
        email: draft.email,
        role: draft.role,
      });
      resetForm();
      await load(keyword);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(user: User) {
    if (!window.confirm(`删除 ${user.name}？`)) return;
    setError('');
    try {
      await removeUser(user.id);
      if (editingId === user.id) resetForm();
      await load(keyword);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#005691] text-white">
            <UserRound size={20} />
          </span>
          <div>
            <h1 className="text-xl font-semibold">用户管理</h1>
            <p className="text-sm text-slate-500">Template 示例。数据在这个进程的 SQLite 里。</p>
          </div>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-xl bg-white p-5 shadow-[0_12px_40px_rgba(14,63,126,0.06)]">
            <h2 className="text-sm font-semibold">{editingId ? '编辑用户' : '新建用户'}</h2>
            <form
              className="mt-4 flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void onSave();
              }}
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-500">姓名</span>
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#005691]"
                  value={draft.name}
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-500">邮箱</span>
                <input
                  className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#005691]"
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft({ ...draft, email: event.target.value })}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-slate-500">角色</span>
                <select
                  className="rounded-lg border border-slate-200 px-3 py-2 outline-none focus:border-[#005691]"
                  value={draft.role}
                  onChange={(event) => setDraft({ ...draft, role: event.target.value as UserRole })}
                >
                  {USER_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  className="rounded-lg bg-[#005691] px-4 py-2 text-sm text-white disabled:opacity-60"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? '保存中' : '保存'}
                </button>
                {editingId && (
                  <button className="rounded-lg px-4 py-2 text-sm text-slate-600" type="button" onClick={resetForm}>
                    取消
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-[0_12px_40px_rgba(14,63,126,0.06)]">
            <form
              className="mb-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void load(keyword);
              }}
            >
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">搜索</span>
                <Search className="pointer-events-none absolute top-2.5 left-3 text-slate-400" size={16} />
                <input
                  className="w-full rounded-lg border border-slate-200 py-2 pr-3 pl-9 outline-none focus:border-[#005691]"
                  placeholder="按姓名或邮箱搜索"
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                />
              </label>
              <button className="rounded-lg border border-slate-200 px-3 text-slate-600" type="submit" aria-label="刷新">
                <RefreshCw size={16} />
              </button>
            </form>

            {error && <p className="mb-3 text-sm text-[#ed0007]">{error}</p>}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="py-2 font-medium">姓名</th>
                    <th className="py-2 font-medium">邮箱</th>
                    <th className="py-2 font-medium">角色</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-slate-100">
                      <td className="py-3">{user.name}</td>
                      <td className="py-3 text-slate-600">{user.email}</td>
                      <td className="py-3">{USER_ROLES.find((role) => role.value === user.role)?.label || user.role}</td>
                      <td className="py-3 text-right">
                        <button
                          className="mr-3 text-[#005691]"
                          type="button"
                          onClick={() => {
                            setEditingId(user.id);
                            setDraft({ name: user.name, email: user.email, role: user.role });
                          }}
                        >
                          编辑
                        </button>
                        <button className="text-slate-400" type="button" aria-label={`删除 ${user.name}`} onClick={() => void onRemove(user)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!loading && users.length === 0 && (
                    <tr>
                      <td className="py-8 text-slate-400" colSpan={4}>还没有用户</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
