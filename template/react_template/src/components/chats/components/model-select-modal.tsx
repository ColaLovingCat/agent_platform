import { useMemo, useState } from 'react';
import { Input, Modal } from 'antd';
import { Search } from 'lucide-react';

import type { ChatModelOption } from '../com/chats.types';

function groupModelsByProvider(items: ChatModelOption[]) {
  const groups = new Map<string, ChatModelOption[]>();

  for (const model of items) {
    const list = groups.get(model.provider) ?? [];
    list.push(model);
    groups.set(model.provider, list);
  }

  return [...groups.entries()];
}

export type ModelSelectModalProps = {
  open: boolean;
  models: ChatModelOption[];
  onClose: () => void;
  onSelect: (model: ChatModelOption) => void;
};

export default function ModelSelectModal({
  open,
  models,
  onClose,
  onSelect,
}: ModelSelectModalProps) {
  const [search, setSearch] = useState('');

  const groupedModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? models.filter((model) => model.name.toLowerCase().includes(q))
      : models;

    return groupModelsByProvider(filtered);
  }, [models, search]);

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  const handleSelect = (model: ChatModelOption) => {
    onSelect(model);
    handleClose();
  };

  return (
    <Modal
      title={
        <div className="pr-10">
          <Input
            allowClear
            placeholder="Search models..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefix={<Search size={14} className="text-gray-400" />}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnHidden
    >
      <div className="max-h-[360px] overflow-y-auto -mx-1 mt-5 px-1">
        {groupedModels.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">No models found</p>
        ) : (
          groupedModels.map(([provider, items]) => (
            <div key={provider} className="mb-4 last:mb-0">
              <div className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {provider}
              </div>
              <div className="space-y-0.5">
                {items.map((model) => (
                  <button
                    key={model.name}
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-indigo-50 hover:text-brand-600"
                    onClick={() => handleSelect(model)}
                  >
                    {model.name}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
