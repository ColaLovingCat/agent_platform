<script lang="ts" setup>
import { ref } from 'vue'
import type { UploadChangeParam } from 'ant-design-vue'

import * as extend from '@/commons/utils/extends'
import { checkAPI } from '@/commons/types/api.types';

import { logger } from '@/commons/utils/logger'
const log = logger.create("Upload");

// name
defineOptions({
  name: 'app-upload'
})

// props
const props = defineProps({
  mode: {
    type: String,
    default: 'default'
  },
  host: {
    type: String,
    require: false,
    default: () => { return checkAPI('/api/File/UploadFile') }
  },
  configs: {
    type: Object,
    require: false,
    default: () => ({
      formName: 'file',
      multiple: true,
      showUploadList: true,
      supports: ['*'],
      buttonText: ''
    })
  },
  // 需要和上传方法一起传递的参数
  params: {
    type: Object,
    require: false,
    default: () => ({})
  },
})

// emits
const emits = defineEmits<{
  (event: 'uploaded', values: any): void
}>()

const headers = {
  authorization: extend.ExLocalStore.get("token"),
};
const fileList = ref([])
const isUploading = ref(false)

const handleChange = (info: UploadChangeParam) => {
  const status = info.file.status
  log.log("file", status)

  isUploading.value = info.fileList.some(file => file.status === 'uploading')

  if (status === 'done') {
    emits('uploaded', info.file.response)
    log.log("file", info.file.response)
  }
}

function handleDrop(e: DragEvent) {
  log.log("drop file")
}

const clearFiles = () => {
  fileList.value = []
}

defineExpose({
  clearFiles
})
</script>

<template>
  <div :class="['upload-view', mode === 'simple' ? 'mode-simple' : 'mode-default']">
    <template v-if="mode === 'simple'">
      <a-upload :name="configs.formName" v-model:fileList="fileList" :multiple="configs.multiple"
        :show-upload-list="configs.showUploadList" :action="host" :headers="headers" :data="params"
        @change="handleChange">
        <a-button type="default" :class="isUploading ? 'bg-default' : 'bg-primary'">
          <i v-if="!isUploading" class="fa-solid fa-upload"></i>
          <i v-else class="fa-solid fa-circle-notch fa-spin"></i>
          {{ configs.buttonText || 'Upload' }}
        </a-button>
      </a-upload>
    </template>

    <template v-else>
      <a-upload-dragger :name="configs.formName" v-model:fileList="fileList" :multiple="configs.multiple"
        :show-upload-list="configs.showUploadList" :action="host" :headers="headers" :data="params"
        @change="handleChange" @drop="handleDrop">
        <p class="ant-upload-drag-icon">
          <inbox-outlined></inbox-outlined>
        </p>
        <i class="fa-solid fa-cloud-arrow-up upload-icon"></i>
        <p class="ant-upload-text">Upload File</p>
        <p class="ant-upload-hint">
          Support Format: <span v-for="item in configs.supports">.{{ item }}</span>
        </p>
      </a-upload-dragger>
    </template>
  </div>
</template>

<style scoped>
.upload-view.mode-default {
  width: 100%;
  height: 220px;
}

.upload-view.mode-simple {
  width: auto;
  height: auto;
}

.upload-icon {
  font-size: 60px;
  margin: 15px;
}
</style>
