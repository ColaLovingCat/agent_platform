import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Table, Pagination, Modal, Popover, Checkbox, Space, Popconfirm, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Search, Plus, Settings2, Edit, Trash2, ListIcon } from 'lucide-react';

// 定义数据类型
interface ItemInfo {
    id: string;
    username: string;
    email: string;
    role: string;
    status: string;
}

const guid = () => {
    return crypto.randomUUID()
}

export default function UserManagePage() {
    // 页面标题和副标题
    const pageConfigs = {
        title: 'Data Management',
        desc: 'Manage your data with table.',
        useDemo: true,
    };

    // --- 表单数据集 ---
    const [searchForm] = Form.useForm();
    const [rows, setRows] = useState<ItemInfo[]>([]);
    const [pagination, setPagination] = useState({
        index: 1, // 当前页码
        size: 10,   // 每页条数
        total: 0,   // 总条数
    });
    const [loading, setLoading] = useState(false);

    // --- 获取数据 ---
    const search = async () => {
        setPagination((state) => ({ ...state, current: 1 }));
        await getlistData();
    };
    const handlePageChange = (page: number, size: number) => {
        setPagination((state) => ({ ...state, index: page, size }));
        getlistData();
    };
    const getlistData = async () => {
        setLoading(true);
        try {
            const searchs = searchForm.getFieldsValue();

            // 模拟返回数据
            await new Promise((resolve) => setTimeout(resolve, 600));
            const mockData = Array.from({ length: pagination.size }).map((_, idx) => ({
                id: guid(),
                username: `User ${searchs.username || ''} ${pagination.index}-${idx}`,
                email: `user${pagination.index}${idx}@example.com`,
                role: idx % 2 === 0 ? 'Admin' : 'User',
                status: idx % 3 === 0 ? 'Inactive' : 'Active'
            }));

            setRows(mockData);
            setPagination((state) => ({ ...state, total: 55 }));
        } catch (error: any) {
            console.error('Get datas failed:', error);
        } finally {
            setLoading(false);
        }
    };

    // 初始化加载
    useEffect(() => {
        const init = async () => {
            await search()
        }
        init()
    }, []);

    // --- 弹窗状态 ---
    const [editForm] = Form.useForm();
    const [editModal, setEditModal] = useState(false);
    const [modalAction, setModalAction] = useState<'add' | 'edit'>('add');
    const [currentRow, setCurrentRow] = useState<ItemInfo | null>(null);
    const [submitLoading, setSubmitLoading] = useState(false);

    // 打开新增/编辑弹窗
    const showModal = (action: 'add' | 'edit', record?: ItemInfo) => {
        setModalAction(action);
        if (action === 'edit' && record) {
            setCurrentRow(record);
            editForm.setFieldsValue(record); // 数据回显
        } else {
            setCurrentRow(null);
            editForm.resetFields(); // 清空表单
        }
        setEditModal(true);
    };

    // 提交保存 (新增或修改)
    const handleSave = async () => {
        setSubmitLoading(true);
        try {
            const values = await editForm.validateFields();

            console.log(`${modalAction} item:`, values, 'ID:', currentRow?.id);
            await new Promise((resolve) => setTimeout(resolve, 500)); // 模拟接口提交

            message.success(`${modalAction === 'add' ? 'Added' : 'Edited'} successfully`);
            setEditModal(false);
            getlistData();
        } catch (error) {
            console.error('Validation failed:', error);
        }
        setSubmitLoading(false);
    };
    // 删除数据
    const handleDelete = async (id: string) => {
        console.log('Delete item ID:', id);
        await new Promise((resolve) => setTimeout(resolve, 500));
        message.success('Deleted successfully');
        getlistData();
    };

    // 操作列
    const ActionCell = ({ value }: { value: ItemInfo }) => {
        return (
            <Space>
                <Button type="text" size="small" className="text-blue-500" onClick={() => showModal('edit', value)}>
                    <Edit size={16} />
                </Button>
                <Popconfirm title="Are you sure to delete this item?" onConfirm={() => handleDelete(value.id)}>
                    <Button type="text" size="small" danger>
                        <Trash2 size={16} />
                    </Button>
                </Popconfirm>
            </Space>
        )
    }

    //#region Columns
    // --- 定义列与显示/隐藏列逻辑 ---
    const baseColumns: ColumnsType<ItemInfo> = [
        { title: 'ID', dataIndex: 'id', key: 'id' },
        { title: 'User Name', dataIndex: 'username', key: 'username' },
        { title: 'Email', dataIndex: 'email', key: 'email' },
        { title: 'Role', dataIndex: 'role', key: 'role' },
        { title: 'Status', dataIndex: 'status', key: 'status' },
        {
            title: 'Actions',
            key: 'action',
            width: 150,
            render: (_, record) => (<ActionCell value={record} />)
        }
    ];
    // 控制列显示的 State
    const defaultColumnKeys = baseColumns.map(col => col.key as string);
    const [visibleColumns, setVisibleColumns] = useState<string[]>(defaultColumnKeys);
    // 过滤出最终要展示的列
    const activeColumns = baseColumns.filter(col => visibleColumns.includes(col.key as string));
    // 列设置的 Popover 内容
    const columnSettingsContent = (
        <Checkbox.Group
            className="flex flex-col gap-2"
            options={baseColumns.map((col) => ({ label: col.title as string, value: col.key as string }))}
            value={visibleColumns}
            onChange={(checkedValues) => setVisibleColumns(checkedValues as string[])}
        />
    );
    //#endregion

    return (
        <div className='sections'>
            {/* Header */}
            <div className="section-header px-8 py-6 mb-3 shrink-0 z-10">
                <div className="titles flex items-end gap-3">
                    <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{pageConfigs.title}</span>
                    <span className="text-sm text-slate-500 font-medium">{pageConfigs.desc}</span>
                </div>
            </div>

            {/* Contents */}
            <div className="section-contents flex-1 px-8 pb-6 min-h-0">

                {/* 顶部工具栏 */}
                <div className="box-bar px-4 rounded-lg flex justify-between items-center">
                    <div className="header-infos text-[#747474] ml-1 text-sm flex items-center gap-3">
                        <ListIcon size={14} />
                        <span>{pagination.total} Items</span>
                    </div>

                    <div className="tools flex items-center gap-4">
                        {/* 搜索区域 */}
                        <div className="box-search flex items-center gap-2">
                            <Form form={searchForm} layout="inline" className="flex flex-wrap gap-2">
                                <Form.Item name="username" className="mb-0">
                                    <Input placeholder="Search User Name" allowClear onPressEnter={search} />
                                </Form.Item>
                            </Form>
                            <Button type="primary" icon={<Search size={14} />} onClick={search}>Search</Button>
                        </div>

                        {/* 动态列设置 */}
                        <Popover content={columnSettingsContent} title="Visible Columns" trigger="click" placement="bottomRight">
                            <Button icon={<Settings2 size={16} />} title="Column Settings" />
                        </Popover>

                        {/* 新增按钮 */}
                        <Button type="primary" icon={<Plus size={14} />} onClick={() => showModal('add')}>
                            Add
                        </Button>
                    </div>
                </div>

                {/* 表格区域 */}
                <div className="box-table mt-4 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    <Table<ItemInfo>
                        rowKey="id"
                        columns={activeColumns}
                        dataSource={rows}
                        loading={loading}
                        pagination={false}
                    />

                    {/* 分页组件 */}
                    <div className="p-4 flex justify-end border-t border-gray-50">
                        <Pagination
                            current={pagination.index}
                            pageSize={pagination.size}
                            total={pagination.total}
                            showSizeChanger
                            onChange={handlePageChange}
                        />
                    </div>
                </div>
            </div>

            {/* 新增/编辑 弹窗 */}
            <Modal
                title={modalAction === 'add' ? 'Add New User' : 'Edit User'}
                open={editModal}
                onOk={handleSave}
                confirmLoading={submitLoading}
                onCancel={() => setEditModal(false)}
                destroyOnHidden
            >
                <Form form={editForm} layout="vertical" className="mt-4">
                    <Form.Item
                        name="username"
                        label="User Name"
                        rules={[{ required: true, message: 'Please input username!' }]}
                    >
                        <Input placeholder="Enter username" />
                    </Form.Item>
                    <Form.Item
                        name="email"
                        label="Email"
                        rules={[
                            { required: true, message: 'Please input email!' },
                            { type: 'email', message: 'Invalid email format!' }
                        ]}
                    >
                        <Input placeholder="Enter email" />
                    </Form.Item>
                    <Form.Item name="role" label="Role">
                        <Input placeholder="Enter role (e.g. Admin, User)" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}