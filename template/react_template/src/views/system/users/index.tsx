import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Switch,
  Table,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import {
  Edit,
  KeyRound,
  Plus,
  Search,
  Settings,
  Trash2,
  Lock,
} from 'lucide-react';

import { useSystemStore } from '@/commons/stores/systems';
import * as messages from '@/commons/utils/messages';
import * as current from '@/services/users.services';
import * as login from '@/services/login.services';

interface UserRole {
  id: string;
  roleName: string;
}

interface UserRow {
  id: string;
  userno: string;
  ntAccount: string;
  username: string;
  deptName: string;
  email?: string;
  status: number | boolean;
  roles: UserRole[];
}

interface RoleRow {
  id: string;
  roleName: string;
  remark?: string;
  users: { id?: string }[];
}

interface UserFormValues {
  userno: string;
  ntAccount: string;
  password?: string;
  username: string;
  deptName: string;
  email?: string;
  status: boolean;
  roleIDs: string[];
}

const defaultUserValues: UserFormValues = {
  userno: '',
  ntAccount: '',
  password: '',
  username: '',
  deptName: '',
  email: '',
  status: true,
  roleIDs: [],
};

const UsersView: React.FC = () => {
  const { t } = useTranslation();
  const adminKey = useSystemStore((s) => s.systemInfo?.adminKey ?? 'SystemAdmin');

  const [searchForm] = Form.useForm();
  const [userForm] = Form.useForm<UserFormValues>();
  const [roleForm] = Form.useForm<{ roleName: string; remark: string }>();

  const [rows, setRows] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination] = useState({ pageIndex: 0, pageSize: 10 });

  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userAction, setUserAction] = useState<'New' | 'Update'>('New');
  const [userId, setUserId] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleRows, setRoleRows] = useState<RoleRow[]>([]);
  const [roleOptions, setRoleOptions] = useState<{ value: string; label: string }[]>([]);

  const getlistData = useCallback(async () => {
    const search = searchForm.getFieldsValue();
    const params: Record<string, string | number> = {
      page: pagination.pageIndex + 1,
      size: pagination.pageSize,
      sort: '',
    };
    if (search.userno?.trim()) params.userno = `match:${search.userno.trim()}`;
    if (search.username?.trim()) params.username = `match:${search.username.trim()}`;
    if (search.ntAccount?.trim()) params.ntAccount = `match:${search.ntAccount.trim()}`;

    try {
      const resp: any = await current.getlistUsers(params);
      const { status, data, message } = resp;
      if (status) {
        const { pagination: pg, items } = data;
        setRows(items ?? []);
        setTotalCount(pg?.totalCount ?? 0);
      } else {
        messages.showError(message);
      }
    } catch (err: any) {
      messages.showError(err);
    }
  }, [pagination.pageIndex, pagination.pageSize, searchForm]);

  const getlistRoles = useCallback(async () => {
    try {
      const resp: any = await current.getlistRoles();
      const { status, data, message } = resp;
      if (status) {
        const list = data ?? [];
        setRoleRows(list);
        setRoleOptions(list.map((a: RoleRow) => ({ value: a.id, label: a.roleName })));
      } else {
        messages.showError(message);
      }
    } catch (err: any) {
      messages.showError(err);
    }
  }, []);

  useEffect(() => {
    getlistData();
  }, [getlistData]);

  const search = () => {
    getlistData();
  };

  const openUserModal = async (action: 'add' | 'update', record?: UserRow) => {
    if (action === 'add') {
      setUserAction('New');
      setUserId('');
      setShowPassword(true);
      userForm.setFieldsValue(defaultUserValues);
      await getlistRoles();
      setUserModalOpen(true);
      return;
    }

    if (!record) return;
    setUserAction('Update');
    setUserId(record.id);
    setShowPassword(false);
    userForm.setFieldsValue({
      userno: record.userno,
      ntAccount: record.ntAccount,
      username: record.username,
      deptName: record.deptName,
      email: record.email ?? '',
      status: !!record.status,
      roleIDs: (record.roles ?? []).map((r) => r.id),
      password: '',
    });
    await getlistRoles();
    setUserModalOpen(true);
  };

  const openRoleModal = async () => {
    roleForm.resetFields();
    await getlistRoles();
    setRoleModalOpen(true);
  };

  const saveUser = async () => {
    let values: UserFormValues;
    try {
      values = await userForm.validateFields();
    } catch {
      return;
    }

    if (
      showPassword &&
      login.checkPassword(values.password ?? '', values.password ?? '') === -2
    ) {
      messages.showError(t('message.password.notcom'));
      return;
    }

    const params: Record<string, unknown> = {
      ...values,
      status: values.status ? 1 : 0,
      email: values.email || '',
      avatar: '',
      id: userAction === 'New' ? '' : userId,
    };
    if (userAction === 'Update') {
      delete params.password;
    }

    try {
      const resp: any = await current.saveUser(params);
      const { status, message } = resp;
      if (status) {
        messages.showSuccess(t('message.saved', 'Saved'));
        await getlistData();
        setUserModalOpen(false);
      } else {
        messages.showError(message);
      }
    } catch (err: any) {
      messages.showError(err);
    }
  };

  const resetPassword = async (record: UserRow) => {
    try {
      const resp: any = await current.resetPassword({ id: record.id });
      const { status, data } = resp;
      if (status) {
        Modal.info({
          title: t('message.password.new', 'New Password'),
          content: data,
        });
      }
    } catch (err: any) {
      messages.showError(err);
    }
  };

  const deleteUser = async (record: UserRow) => {
    try {
      const resp: any = await current.deleteUser({ id: record.id });
      const { status, message } = resp;
      if (status) {
        messages.showSuccess(t('message.deleted', 'Deleted'));
        await getlistData();
      } else {
        messages.showError(message);
      }
    } catch (err: any) {
      messages.showError(err);
    }
  };

  const saveRole = async () => {
    try {
      await roleForm.validateFields();
    } catch {
      return;
    }

    const values = roleForm.getFieldsValue();
    try {
      const resp: any = await current.saveRole({ ...values, id: '' });
      const { status, message } = resp;
      if (status) {
        messages.showSuccess(t('message.saved', 'Saved'));
        await getlistRoles();
        roleForm.resetFields();
      } else {
        messages.showError(message);
      }
    } catch (err: any) {
      messages.showError(err);
    }
  };

  const deleteRole = async (record: RoleRow) => {
    try {
      const resp: any = await current.deleteRole({ id: record.id });
      const { status, message } = resp;
      if (status) {
        messages.showSuccess(t('message.deleted', 'Deleted'));
        await getlistRoles();
        await getlistData();
      } else {
        messages.showError(message);
      }
    } catch (err: any) {
      messages.showError(err);
    }
  };

  const columns: ColumnsType<UserRow> = useMemo(
    () => [
      { key: 'userno', dataIndex: 'userno', title: 'User No' },
      { key: 'ntAccount', dataIndex: 'ntAccount', title: 'NT Account' },
      { key: 'username', dataIndex: 'username', title: 'User Name' },
      { key: 'deptName', dataIndex: 'deptName', title: 'Department' },
      { key: 'email', dataIndex: 'email', title: 'Email' },
      {
        key: 'status',
        dataIndex: 'status',
        title: 'isActive',
        render: (status: number | boolean) =>
          status ? (
            <span className="inline-block px-2.5 py-0.5 rounded text-white text-xs bg-emerald-500">
              {t('form.active', 'Active')}
            </span>
          ) : (
            <span className="inline-block px-2.5 py-0.5 rounded text-xs text-black/40 bg-gray-200">
              {t('form.inactive', 'Inactive')}
            </span>
          ),
      },
      {
        key: 'roles',
        dataIndex: 'roles',
        title: 'Roles',
        render: (roles: UserRole[] = []) => (
          <div className="flex flex-wrap gap-2">
            {roles.map((role) => (
              <span
                key={role.id}
                className="px-2.5 py-1 text-sm font-bold rounded bg-slate-200/55"
              >
                {role.roleName}
              </span>
            ))}
          </div>
        ),
      },
      {
        key: 'actions',
        dataIndex: 'actions',
        title: 'Actions',
        width: 140,
        render: (_: unknown, record: UserRow) => (
          <div className="flex items-center gap-1">
            <Tooltip title={t('btn.edit', 'Edit')}>
              <Button
                type="default"
                icon={<Edit size={14} />}
                onClick={() => openUserModal('update', record)}
              />
            </Tooltip>
            <Tooltip title={t('btn.change_password', 'Reset Password')}>
              <Popconfirm
                title="Are you sure reset password for this user?"
                okText="Yes"
                cancelText="No"
                onConfirm={() => resetPassword(record)}
              >
                <Button type="default" icon={<KeyRound size={14} />} />
              </Popconfirm>
            </Tooltip>
            <Tooltip title={t('btn.delete', 'Delete')}>
              <Popconfirm
                title="Are you sure delete this user?"
                okText="Yes"
                cancelText="No"
                onConfirm={() => deleteUser(record)}
              >
                <Button type="default" icon={<Trash2 size={14} />} />
              </Popconfirm>
            </Tooltip>
          </div>
        ),
      },
    ],
    [t],
  );

  const roleColumns: ColumnsType<RoleRow> = useMemo(
    () => [
      { key: 'roleName', dataIndex: 'roleName', title: 'Role Name' },
      { key: 'remark', dataIndex: 'remark', title: 'Remark' },
      {
        key: 'count',
        dataIndex: 'users',
        title: 'Assigned Users',
        render: (users: RoleRow['users'] = []) => <span>{users.length}</span>,
      },
      {
        key: 'actions',
        dataIndex: 'actions',
        title: 'Actions',
        width: 80,
        render: (_: unknown, record: RoleRow) =>
          record.roleName === adminKey ? (
            <Button type="default" disabled icon={<Lock size={14} />} />
          ) : (
            <Popconfirm
              title="Are you sure delete this role?"
              okText="Yes"
              cancelText="No"
              onConfirm={() => deleteRole(record)}
            >
              <Button type="default" icon={<Trash2 size={14} />} />
            </Popconfirm>
          ),
      },
    ],
    [adminKey],
  );

  return (
    <div className="sections bg-[#F8FAFC]">
      {/* Header */}
      <div className="section-header px-8 py-6 mb-3 shrink-0 z-10">
        <div className="titles flex items-end gap-3">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{t('user.title', 'User Management')}</span>
          <span className="text-sm text-slate-500 font-medium">{t('user.desc', 'Manage system users and roles')}</span>
        </div>
      </div>

      <div className="section-contents px-8 flex flex-col">
        <div className="box-bar p-2.5 rounded-lg flex justify-between items-center">
          <div className="header text-[1.1rem]">
            <span className="header-infos text-[#747474] ml-1">{totalCount} Items</span>
          </div>
          <div className="tools flex items-center gap-4">
            <div className="box-search flex items-center gap-2">
              <Form form={searchForm} layout="inline" className="flex flex-wrap gap-2">
                <Form.Item name="userno" className="mb-0">
                  <Input placeholder="User No" allowClear />
                </Form.Item>
                <Form.Item name="username" className="mb-0">
                  <Input placeholder="User Name" allowClear />
                </Form.Item>
                <Form.Item name="ntAccount" className="mb-0">
                  <Input placeholder="NT Account" allowClear />
                </Form.Item>
              </Form>
              <Button type="default" icon={<Search size={14} />} onClick={search}>
                {t('btn.search', 'Search')}
              </Button>
            </div>
            <Button type="primary" icon={<Plus size={14} />} onClick={() => openUserModal('add')}>
              {t('user.addUser', 'Add User')}
            </Button>
            <Button type="primary" icon={<Settings size={14} />} onClick={openRoleModal}>
              {t('user.roleConfig', 'Role Config')}
            </Button>
          </div>
        </div>

        <div className="box-table box-shadow mt-2 bg-white rounded-lg overflow-hidden">
          <Table<UserRow>
            rowKey="id"
            columns={columns}
            dataSource={rows}
            pagination={false}
          />
        </div>
      </div>

      <Modal
        open={userModalOpen}
        title={`${userAction} User`}
        onOk={saveUser}
        onCancel={() => setUserModalOpen(false)}
        destroyOnClose
      >
        <Form form={userForm} layout="vertical" preserve={false}>
          <Form.Item
            name="userno"
            label="User No"
            rules={[{ required: true, message: 'User No is required' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="ntAccount"
            label="NT Account"
            rules={[{ required: true, message: 'NT Account is required' }]}
          >
            <Input />
          </Form.Item>
          {showPassword && (
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Password is required' }]}
            >
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item
            name="username"
            label="User Name"
            rules={[{ required: true, message: 'User Name is required' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="deptName"
            label="Department"
            rules={[{ required: true, message: 'Department is required' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: 'email', message: 'Invalid email' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="status" label="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="roleIDs" label="Roles">
            <Select mode="multiple" options={roleOptions} allowClear />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={roleModalOpen}
        title={t('user.rolelist', 'Role List')}
        width="60vw"
        footer={null}
        onCancel={() => setRoleModalOpen(false)}
        destroyOnClose
      >
        <div className="role-modal">
          <div className="box-table">
            <Table<RoleRow>
              rowKey="id"
              columns={roleColumns}
              dataSource={roleRows}
              pagination={false}
            />
          </div>
          <div className="box-forms mt-1 pt-4 border-t border-slate-300/55 flex items-start gap-3">
            <Form form={roleForm} layout="inline" className="flex-1 flex flex-wrap gap-2">
              <Form.Item
                name="roleName"
                label="Role Name"
                rules={[{ required: true, message: 'Role Name is required' }]}
                className="mb-0"
              >
                <Input placeholder="Role Name" />
              </Form.Item>
              <Form.Item name="remark" label="Remark" className="mb-0">
                <Input placeholder="Remark" />
              </Form.Item>
            </Form>
            <Button type="primary" onClick={saveRole}>
              {t('btn.save', 'Save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

UsersView.displayName = 'app-users';
export default UsersView;
