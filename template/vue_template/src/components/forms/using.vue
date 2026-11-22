<script lang="ts" setup>
import { reactive, ref, type Ref } from 'vue';

import formView from '@/components/forms/view.vue'
import type { FormItem } from '@/components/forms/form.types';

import * as messages from '@/commons/utils/messages'
import { logger } from '@/commons/utils/logger'
const log = logger.create("Form");

// name
defineOptions({
    name: 'custom-name'
})

const formRef = ref();
const formConfig = reactive({
    class: {
        forms: '',
        items: 'inline',
        label: 'col-2',
    },
    format: {
        date: 'YYYY-MM-DD',
        time: 'HH:mm:ss'
    },
    showError: true
})
const formList: Ref<FormItem[]> = ref([
    {
        type: 'input',
        key: 'username',
        label: 'Username',
        required: true,
    },
    {
        type: 'input',
        key: 'password',
        label: 'Password',
        isPassword: true,
        required: true,
    },
    {
        type: 'input',
        key: 'number',
        label: 'Number',
        isNumber: true,
    },
    {
        type: 'input',
        key: 'email',
        label: 'Email',
        isEmail: true,
    },
    {
        type: 'textarea',
        key: 'desc',
        label: 'Description',
        required: true,
        activeClear: true,
    },
    {
        type: 'select',
        key: 'location',
        label: 'Location',
        required: true,
        activeClear: true,
        activeSearch: true,
        list: [
            { value: 'Asia', label: 'Asia' },
            { value: 'Europe', label: 'Europe' },
        ],
    },
    {
        type: 'select',
        key: 'week',
        label: 'Week',
        hidden: (formValues: any) => formValues.location !== 'Asia',
        isMulti: true,
        activeClear: true,
        list: [
            { value: "Mon", label: "Monday" },
            { value: "Tue", label: "Tuesday" },
            { value: "Wed", label: "Wednesday" },
            { value: "Thu", label: "Thursday" },
            { value: "Fri", label: "Friday" },
            { value: "Sat", label: "Saturday" },
            { value: "Sun", label: "Sunday" },
        ],
    },
    {
        type: 'switch',
        key: 'status',
        label: 'Status',
        required: true,
    },
    {
        type: 'radios',
        key: 'sex',
        label: 'Sex',
        required: true,
        list: [
            { value: '男', label: '男' },
            { value: '女', label: '女' },
        ],
    },
    {
        type: 'checks',
        key: 'hobby',
        label: 'Hobby',
        required: true,
        list: [
            { value: 'game', label: 'game' },
            { value: 'book', label: 'book' },
            { value: 'code', label: 'code' },
        ],
    },
    {
        type: 'date',
        key: 'birthday',
        label: 'Birthday',
        required: true,
    },
    {
        type: 'datetime',
        key: 'datetime',
        label: 'Datetime',
        required: false,
    },
    {
        type: 'date-range',
        key: 'fromto',
        label: 'From to',
        required: true,
    },
    {
        type: 'datetime-range',
        key: 'fromtotime',
        label: 'From to',
        required: false,
    },
    {
        type: 'custom',
        key: 'customSlot',
        label: 'Custom Slot',
        required: false
    }
])
const formValue: any = ref({
    username: '',
    password: '',
    number: '',
    emial: '',
    desc: '',
    location: null,
    week: [],
    status: false,
    sex: null,
    hobby: [],
    birthday: null,
    datetime: null,
    fromto: [],
    fromtotime: [],
    customSlot: 12
})
//
const onChange = (key: string) => {
    log.log('changed', key)
}
const onSubmit = () => {
    if (formRef.value?.validate()) {
        messages.showSuccess('校验通过！可以提交')
    } else {
        messages.showError('校验失败！请修正错误')
    }
}
</script>

<template>
    <div class="box-forms">
        <div class="box-form">
            <formView ref="formRef" :config="formConfig" :forms="formList" v-model:values="formValue"
                @changed="onChange">
                <template #customSlot="{ value, onChange }">
                    <a-slider style="flex:1" :value="value" @change="onChange" :min="0" :max="100" />
                </template>
            </formView>
            <a-button type="primary" @click="onSubmit">Submit</a-button>
        </div>
        <div class="box-result">
            <template v-for="item in formList" :key="item.key">
                <p>{{ item.label }}: {{ formValue[item.key] }}</p>
            </template>
        </div>
    </div>
</template>

<style scoped lang="scss">
.box-forms {
    display: flex;
    gap: 20px;

    .box-form {
        padding: 20px;
        width: 700px;
    }

    .box-result {
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
}
</style>
