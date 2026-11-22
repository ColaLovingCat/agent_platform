import UploadView from '@/components/uploads';

const UploadUse = () => {
    const uploadConfig = {
        action: 'https://szhlinvma75.apac.bosch.com:59193/api/upload',
        name: 'File',
        multiple: false,
        showUploadList: true,
        accept: '.png, .pdf',
    }

    const params = {
        data: 1
    }

    const uploaded = (resp: any) => {
        console.log(resp)
    }

    return (
        <div className='sections flex justify-center items-center gap-5'>
            <div className='w-[300px] h-[100px]'>
                <UploadView configs={uploadConfig} params={params} uploaded={uploaded}></UploadView>
            </div>
            <UploadView mode='button' configs={uploadConfig} params={params} uploaded={uploaded}></UploadView>
        </div>
    );
};

export default UploadUse;
