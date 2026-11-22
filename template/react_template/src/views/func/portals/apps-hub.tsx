import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Upload,
  message,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  AlertTriangle,
  Boxes,
  History,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react';

import { APP_ID_PATTERN, clearPortalAppsCache, isValidAppId } from '@/commons/datas/apps';
import {
  addPortalApp,
  deletePortalApp,
  getlistPortalApps,
  publishPortalApp,
  rollbackPortalApp,
  type PortalAppApiItem,
} from '@/services/portal-apps.services';

const VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,31}$/;

const PACK_TIPS = (
          <ul className="text-xs m-0 pl-4 space-y-1 max-w-xs text-left">
            <li>
              <code>id</code>: <code>{String(APP_ID_PATTERN)}</code>
            </li>
            <li>
              <code>version</code>: <code>{String(VERSION_PATTERN)}</code>
            </li>
            <li>
              Live files: <code>public/apps/&#123;id&#125;/</code>
            </li>
            <li>
              Meta: <code>public/apps/_versions</code> (registry.json +{' '}
              <code>{'{id}/{version}.zip'}</code>)
            </li>
            <li>
              Vite <code>base: &apos;/apps/&#123;id&#125;/&apos;</code>; zip must include{' '}
              <code>index.html</code>
            </li>
          </ul>
);

export default function AppsHub() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<PortalAppApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm] = Form.useForm();
  const previewIcon = Form.useWatch('icon', createForm) || 'fa-cube';
  const previewColor = Form.useWatch('color', createForm) || '#0f766e';
  const previewName = Form.useWatch('name', createForm) || 'App name';
  const previewId = Form.useWatch('id', createForm) || 'app-id';

  const [releaseApp, setReleaseApp] = useState<PortalAppApiItem | null>(null);
  const [releasing, setReleasing] = useState(false);
  const [releaseForm] = Form.useForm();
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const [rollbackApp, setRollbackApp] = useState<PortalAppApiItem | null>(null);
  const [rollbackVersion, setRollbackVersion] = useState<string>();
  const [rollingBack, setRollingBack] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getlistPortalApps();
      setApps(list);
      clearPortalAppsCache();
    } catch (err: any) {
      message.error(err?.message || 'Failed to load apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (a) => a.id.toLowerCase().includes(q) || (a.name || '').toLowerCase().includes(q),
    );
  }, [apps, keyword]);

  const openApp = (id: string) => navigate(`/apps/${id}`);

  const resetZip = () => {
    setZipFile(null);
    setFileList([]);
  };

  const onDelete = (app: PortalAppApiItem) => {
    Modal.confirm({
      title: `Delete app "${app.name}"?`,
      content: 'This removes registry entry, live files under public/apps/{id}, and all zips under public/apps/_versions/{id}.',
      okText: 'Delete',
      cancelText: 'Cancel',
      okType: 'danger',
      onOk: async () => {
        try {
          await deletePortalApp(app.id, !app.dynamic);
          message.success('Deleted');
          await load();
        } catch (err: any) {
          message.error(err?.message || 'Delete failed');
        }
      },
    });
  };

  const onCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreating(true);
      await addPortalApp({
        id: values.id,
        name: values.name,
        description: values.description,
        icon: values.icon,
        color: values.color,
      });
      message.success('Registered. Use Publish to upload a version zip.');
      setCreateOpen(false);
      createForm.resetFields();
      clearPortalAppsCache();
      await load();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Register failed');
    } finally {
      setCreating(false);
    }
  };

  const onRelease = async () => {
    if (!releaseApp) return;
    try {
      const values = await releaseForm.validateFields();
      if (!zipFile) {
        message.warning('Please upload a zip');
        return;
      }
      setReleasing(true);
      await publishPortalApp({
        id: releaseApp.id,
        version: values.version,
        name: releaseApp.name,
        description: releaseApp.description,
        icon: releaseApp.icon,
        color: releaseApp.color,
        zip: zipFile,
      });
      message.success(`Published v${values.version}`);
      setReleaseApp(null);
      releaseForm.resetFields();
      resetZip();
      clearPortalAppsCache();
      await load();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.message || 'Publish failed');
    } finally {
      setReleasing(false);
    }
  };

  const onRollback = async () => {
    if (!rollbackApp || !rollbackVersion) {
      message.warning('Select a version to rollback');
      return;
    }
    setRollingBack(true);
    try {
      await rollbackPortalApp(rollbackApp.id, rollbackVersion);
      message.success(`Rolled back to v${rollbackVersion}`);
      setRollbackApp(null);
      setRollbackVersion(undefined);
      clearPortalAppsCache();
      await load();
    } catch (err: any) {
      message.error(err?.message || 'Rollback failed');
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2 m-0">
              <Boxes className="w-5 h-5 text-emerald-600 shrink-0" />
              Apps Hub
              <Tooltip title={PACK_TIPS} placement="bottomLeft" color="#fff" styles={{ container: { color: '#334155' } }}>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full p-0.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 border-0 bg-transparent cursor-pointer"
                  aria-label="Packaging and version tips"
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              </Tooltip>
            </h1>
            <p className="text-sm text-slate-500 mt-1 mb-0">
              Register app metadata, then Publish a version zip; click the path to open.
            </p>
          </div>
        </div>
        <Space wrap>
          <Input
            allowClear
            prefix={<Search className="w-3.5 h-3.5 text-slate-400" />}
            placeholder="Search name / id"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-52"
          />
          <Button icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              createForm.setFieldsValue({ icon: 'fa-cube', color: '#0f766e' });
              setCreateOpen(true);
            }}
          >
            Register App
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {filtered.map((app) => (
          <Col key={app.id} xs={24} sm={12} lg={8}>
            <Card
              loading={loading}
              size="small"
              title={
                <span className="flex items-center gap-2">
                  <i className={`fa-solid ${app.icon}`} style={{ color: app.color }} />
                  {app.name}
                </span>
              }
              extra={
                <Space size={4} wrap>
                  {app.dynamic ? <Tag color="blue">dynamic</Tag> : <Tag>builtin</Tag>}
                  {app.deployed ? <Tag color="success">deployed</Tag> : <Tag color="warning">no files</Tag>}
                  {app.currentVersion ? <Tag color="geekblue">v{app.currentVersion}</Tag> : null}
                </Space>
              }
              actions={[
                <Button
                  key="pub"
                  type="link"
                  size="small"
                  icon={<UploadCloud className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setReleaseApp(app);
                    releaseForm.setFieldsValue({ version: '1.0.0' });
                    resetZip();
                  }}
                >
                  Publish
                </Button>,
                <Button
                  key="rb"
                  type="link"
                  size="small"
                  icon={<History className="w-3.5 h-3.5" />}
                  disabled={!app.versions?.length}
                  onClick={() => {
                    setRollbackApp(app);
                    setRollbackVersion(
                      app.versions?.find((v) => v.version !== app.currentVersion)?.version
                        ?? app.versions?.[0]?.version,
                    );
                  }}
                >
                  Rollback
                </Button>,
                <Button
                  key="del"
                  type="link"
                  size="small"
                  danger
                  disabled={!app.dynamic}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  onClick={() => onDelete(app)}
                >
                  Delete
                </Button>,
              ]}
            >
              <p className="text-xs text-slate-500 m-0 mb-2 line-clamp-2">{app.description || '—'}</p>
              <button
                type="button"
                className="text-[11px] font-mono text-emerald-700 hover:text-emerald-900 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                onClick={() => openApp(app.id)}
                title="Open app"
              >
                /apps/{app.id}
              </button>
              {app.versions && app.versions.length > 0 && (
                <div className="text-[10px] text-slate-400 mt-1">
                  {app.versions.length} archived version{app.versions.length === 1 ? '' : 's'}
                  {app.versions.length <= 4
                    ? `: ${app.versions.map((v) => v.version).join(', ')}`
                    : ''}
                </div>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      {!loading && filtered.length === 0 && (
        <div className="text-center text-slate-400 py-16 text-sm">
          {apps.length === 0 ? 'No apps yet. Register one, then Publish a zip.' : 'No matches'}
        </div>
      )}

      {/* Register app: metadata + preview */}
      <Modal
        title="Register App"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={onCreate}
        confirmLoading={creating}
        okText="Register"
        cancelText="Cancel"
        destroyOnHidden
        width={640}
      >
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4 mt-2">
          <Form form={createForm} layout="vertical" initialValues={{ icon: 'fa-cube', color: '#0f766e' }}>
            <Form.Item
              label="App ID"
              name="id"
              rules={[
                { required: true, message: 'Required' },
                {
                  validator: (_, v) =>
                    !v || isValidAppId(v)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Invalid id format')),
                },
              ]}
            >
              <Input placeholder="e.g. demo-a" />
            </Form.Item>
            <Form.Item label="Name" name="name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="Display name" />
            </Form.Item>
            <Form.Item label="Description" name="description">
              <Input.TextArea rows={2} placeholder="Short description" />
            </Form.Item>
            <Form.Item label="Icon (Font Awesome)" name="icon">
              <Input placeholder="fa-cube" />
            </Form.Item>
            <Form.Item label="Color" name="color">
              <Input type="color" className="max-w-[120px]" />
            </Form.Item>
          </Form>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center justify-center gap-2 min-h-[140px]">
            <span className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">Preview</span>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: previewColor }}
            >
              <i className={`fa-solid ${previewIcon} text-lg`} />
            </div>
            <div className="text-center px-1">
              <div className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{previewName}</div>
              <code className="text-[10px] text-slate-500">/apps/{previewId}</code>
            </div>
          </div>
        </div>
      </Modal>

      {/* Publish existing app: version + zip only */}
      <Modal
        title={releaseApp ? `Publish「${releaseApp.name}」` : 'Publish'}
        open={Boolean(releaseApp)}
        onCancel={() => {
          setReleaseApp(null);
          resetZip();
        }}
        onOk={onRelease}
        confirmLoading={releasing}
        okText="Publish"
        cancelText="Cancel"
        destroyOnHidden
        width={480}
      >
        <p className="text-xs text-slate-500 mb-3">
          Target: <code>/apps/{releaseApp?.id}</code>
          {releaseApp?.currentVersion ? ` · current v${releaseApp.currentVersion}` : ''}
        </p>
        <Form form={releaseForm} layout="vertical" initialValues={{ version: '1.0.0' }}>
          <Form.Item
            label="Version"
            name="version"
            rules={[
              { required: true, message: 'Required' },
              { pattern: VERSION_PATTERN, message: 'Invalid version format' },
            ]}
            extra="Archived to _versions/{id}/{version}.zip"
          >
            <Input placeholder="e.g. 1.0.0" />
          </Form.Item>
          <Form.Item label="Build zip" required>
            <Upload.Dragger
              accept=".zip"
              maxCount={1}
              fileList={fileList}
              beforeUpload={(file) => {
                setZipFile(file);
                setFileList([
                  {
                    uid: file.uid,
                    name: file.name,
                    status: 'done',
                    size: file.size,
                  },
                ]);
                return false;
              }}
              onRemove={resetZip}
            >
              <p className="ant-upload-drag-icon flex justify-center">
                <UploadCloud className="w-8 h-8 text-emerald-600" />
              </p>
              <p className="ant-upload-text text-sm">Drop built zip (must include index.html)</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={rollbackApp ? `Rollback "${rollbackApp.name}"` : 'Rollback'}
        open={Boolean(rollbackApp)}
        onCancel={() => {
          setRollbackApp(null);
          setRollbackVersion(undefined);
        }}
        onOk={onRollback}
        confirmLoading={rollingBack}
        okText="Confirm Rollback"
        cancelText="Cancel"
        destroyOnHidden
      >
        <p className="text-xs text-slate-500 mb-3">
          Current version: <strong>{rollbackApp?.currentVersion || '—'}</strong>
        </p>
        <Select
          className="w-full"
          placeholder="Select version"
          value={rollbackVersion}
          onChange={setRollbackVersion}
          options={(rollbackApp?.versions ?? []).map((v) => ({
            value: v.version,
            label: `v${v.version}${v.version === rollbackApp?.currentVersion ? ' (current)' : ''}`,
          }))}
        />
      </Modal>
    </div>
  );
}
