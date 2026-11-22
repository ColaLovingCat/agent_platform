import { useState, useEffect, useMemo } from 'react';
import { Button, Form, Input, Tag, Divider, Spin } from 'antd';
import {
  Plus, Inbox, MousePointerClick, Trash2, Save, Calendar, RefreshCcw, Search
} from 'lucide-react';

import * as extend from '@/commons/utils/extends'
import * as messages from '@/commons/utils/messages'

interface ItemInfo {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
}

type ViewStatus = 'Initial' | 'Edit' | 'New';

const ListView = () => {
  const pageConfigs = {
    title: 'Item Management',
    desc: 'Manage items and markdown prompts for your agents.',
    useDemo: true,
  };

  // --- State Management ---
  const [status, setStatus] = useState<ViewStatus>('Initial');
  const [datas, setDatas] = useState<ItemInfo[]>([]);
  const [loading, setLoading] = useState(false);
  // Search
  const [showSearch, setShowSearch] = useState(false);
  const toggleSearch = () => {
    setShowSearch(!showSearch);
    if (showSearch) {
      setSearchText('');
    }
  };
  const [searchText, setSearchText] = useState('');
  const filteredDatas = useMemo(() => {
    if (!searchText) return datas;
    return datas.filter(item =>
      item.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [datas, searchText]);
  //
  const getlistData = async () => {
    setLoading(true)
    try {
      // 模拟获取数据
      await new Promise((resolve) => setTimeout(resolve, 600));
      const mockData = Array.from({ length: 5 }).map((_, idx) => ({
        id: extend.ExString.uuid(),
        name: `Item - ${idx}`,
        description: `user@example.com`,
        updatedAt: extend.ExDate.format(new Date()),
      }));

      setDatas(mockData)
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => {
    const init = async () => {
      await getlistData();
    };
    init();
  }, []);

  // 状态联动：回填表单
  const [activeId, setActiveId] = useState<string>('');
  const activeItem = useMemo(() => datas.find(d => d.id === activeId) || null, [datas, activeId]);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [form] = Form.useForm();
  useEffect(() => {
    if (status === 'New') {
      form.resetFields();
    } else if (activeItem) {
      form.setFieldsValue(activeItem);
    }
  }, [activeId, status, activeItem, form]);

  // --- Actions ---
  const handleCreateNew = () => {
    setActiveId('');
    setStatus('New');
  };
  const handleSelect = async (item: any) => {
    setActiveId(item.id);
    setStatus('Edit');
  };

  const handleSave = async () => {
    setLoadingEdit(true)
    try {
      const values = await form.validateFields();
      if (status === 'New') {
        const newItem = {
          ...values,
          id: extend.ExString.uuid(),
          updatedAt: new Date().toISOString().split('T')[0]
        };

        // 模拟增加数据
        await new Promise((resolve) => setTimeout(resolve, 600));
        setDatas(prev => [newItem, ...prev]);

        setActiveId(newItem.id);
        setStatus('Edit');
        messages.showSuccess('item created successfully!');
      } else {
        // 模拟更新数据
        await new Promise((resolve) => setTimeout(resolve, 600));
        setDatas(prev => prev.map(item => item.id === activeId ? { ...item, ...values, updatedAt: new Date().toISOString().split('T')[0] } : item));
        
        messages.showSuccess('item updated successfully!');
      }
    } catch (error: any) {
      messages.showError(error);
    }
    setLoadingEdit(false)
  };

  const handleDelete = () => {
    setDatas(prev => prev.filter(item => item.id !== activeId));
    setActiveId('');
    setStatus('Initial');
    messages.showSuccess('item deleted');
  };

  return (
    // 满屏高度，配合 overflow-hidden
    <div className="sections overflow-hidden bg-[#F8FAFC] flex flex-col">

      {/* Header */}
      <div className="section-header px-8 py-6 mb-3 shrink-0 z-10">
        <div className="titles flex items-end gap-3">
          <span className="text-2xl font-extrabold text-slate-900 tracking-tight">{pageConfigs.title}</span>
          <span className="text-sm text-slate-500 font-medium">{pageConfigs.desc}</span>
        </div>
      </div>

      {/* Contents */}
      <div className="section-contents flex-1 px-8 pb-6 flex gap-6 min-h-0">

        {/* ====== 左侧：技能列表 ====== */}
        <div className="left w-full max-w-[360px] flex flex-col h-full bg-transparent">
          <div className="header flex items-center justify-between mb-4 shrink-0 px-1">
            <div className="infos text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <i className="bosch-ic bosch-ic-education font-medium text-indigo-500"></i>
              {datas.length} Items
            </div>

            <div className="tools flex items-center gap-2">
              <Button type="text" icon={<Search size={16} />} className="text-slate-500 hover:bg-slate-200" onClick={toggleSearch} />
              <Button type="text" icon={<RefreshCcw size={16} />} className="text-slate-500 hover:bg-slate-200" onClick={getlistData} />
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={handleCreateNew}
                className="bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-200 rounded-lg"
              >
                New
              </Button>
            </div>
          </div>

          {showSearch && (
            <div className="search-box mb-4 px-1 animate-in fade-in slide-in-from-top-2 duration-200">
              <Input
                placeholder="Search by name..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<Search size={14} className="text-slate-400 mr-1" />}
                allowClear
                autoFocus
                className="w-full rounded-lg border-slate-200 hover:border-indigo-300 focus-within:border-indigo-500 focus-within:shadow-sm"
              />
            </div>
          )}

          <Spin spinning={loading}>
            <div className="list-items flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar pb-10">
              {datas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="w-12 h-12 bg-white shadow-sm border border-slate-100 rounded-xl flex items-center justify-center mb-4">
                    <Inbox size={24} className="text-slate-400" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-700 mb-1">No data</h3>
                  <p className="text-xs text-slate-500 max-w-[200px]">create a new item</p>
                </div>
              ) : (
                filteredDatas.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className={`item-box p-4 rounded-2xl border transition-all duration-200 cursor-pointer group ${activeId === item.id
                      ? 'bg-indigo-50/50 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                      : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'
                      }`}
                  >
                    <div className="font-bold text-slate-800 mb-2 truncate group-hover:text-indigo-600">
                      {item.name}
                    </div>
                    <div className="text-slate-500 text-xs mb-2 truncate">
                      {item.description}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 w-fit px-2 py-1 rounded-md border border-slate-100">
                      <Calendar size={14} className="text-blue-500" />
                      <span className="font-mono truncate max-w-[200px]">{item.updatedAt}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Spin>
        </div>

        {/* ====== 右侧：详情与预览 ====== */}
        <div className="right flex-1 h-full min-w-0">
          {status === 'Initial' ? (
            <div className="h-full bg-white/50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 text-slate-300">
                <MousePointerClick size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-600 mb-2">Select a item to edit</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                Create a new item or select a item to edit.
              </p>
            </div>
          ) : (
            <div className="box-infos h-full bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
              {/* 操作栏 */}
              <div className="header shrink-0 h-16 px-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="infos flex items-center gap-3">
                  <span className="text-slate-400 text-sm font-medium">{status}</span>
                  {status !== 'New' && <Tag color="purple" className="border-none font-mono">ID: {activeId}</Tag>}
                </div>
                <div className="tools flex items-center gap-3">
                  {status == 'New' ? (
                    <></>
                  ) : (
                    <>
                      <Button type="text" danger icon={<Trash2 size={16} />} onClick={handleDelete}></Button>
                    </>
                  )}
                  <Divider orientation="vertical" className="bg-slate-200 h-6 mx-0" />
                  <Button type="primary" loading={loadingEdit} icon={<Save size={16} />} onClick={handleSave} className="bg-slate-900 hover:bg-slate-800 border-none rounded-lg">
                    Save
                  </Button>
                </div>
              </div>

              {/* 内容区：上半部分表单，下半部分预览 */}
              <div className="box-contents flex-1 overflow-y-auto p-8 custom-scrollbar flex flex-col gap-6">

                {/* 1. 基础信息表单区 */}
                <Form form={form} layout="vertical" className="saas-form shrink-0">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <Form.Item
                      label="Name"
                      name="name"
                      className="col-span-1"
                      rules={[{ required: true, message: 'Name is required' }]}
                    >
                      <Input size="large" placeholder="e.g. Name" className="rounded-xl font-medium" />
                    </Form.Item>
                    <Form.Item
                      label="Description"
                      name="description"
                      className="col-span-1"
                    >
                      <Input size="large" placeholder="e.g. Description" className="rounded-xl font-medium" />
                    </Form.Item>
                  </div>
                </Form>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ListView;