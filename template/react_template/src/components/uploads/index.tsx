import React from 'react';
import { Button, Upload, type UploadProps } from 'antd';
import { UploadCloud } from 'lucide-react';

const { Dragger } = Upload;

interface Config {
    action?: string;
    name?: string;
    multiple?: boolean;
    showUploadList?: boolean;
    accept?: string;
}

export interface ComponentProps {
    mode?: 'drag' | 'button';
    configs?: Config;
    params?: Record<string, any>;
    uploaded: (params: any) => void;
}

const UploadView: React.FC<ComponentProps> = ({
    mode = 'drag',
    configs = {
        action: '/api/upload',
        name: 'file',
        multiple: true,
        showUploadList: true,
        accept: '*',
    },
    params = {},
    uploaded,
}) => {
    const props: UploadProps = {
        ...configs,
        data: params,
        onChange(info) {
            const { status } = info.file;

            if (status === 'done') {
                uploaded(info.file.response);
            }
        },
        onDrop(e) {
            console.log('Dropped files', e.dataTransfer.files);
        },
    };

    return (
        <>
            {mode === 'drag' ? (
                <Dragger {...props}>
                    <div className="flex justify-center mb-2">
                        <UploadCloud className="text-blue-500 w-8 h-8" strokeWidth={1.5} />
                    </div>
                    <p className="text-gray-600 text-sm">Click or drag file to upload</p>
                    {configs.accept && configs.accept !== '*' && (
                        <p className="text-gray-400 text-xs">
                            support: <span className="font-semibold">{configs.accept}</span>
                        </p>
                    )}
                </Dragger>
            ) : (
                <Upload {...props}>
                    <Button type="primary" icon={<UploadCloud className="w-4 h-4" />}>
                        Upload
                    </Button>
                </Upload>
            )}
        </>
    );
};

export default UploadView;