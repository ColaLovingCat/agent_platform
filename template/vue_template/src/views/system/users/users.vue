<script lang="ts" setup>
import { onMounted, ref, type Ref, reactive } from 'vue'

import { useSystemInfosStore } from '@/commons/stores/index'
const systemInfosStore = useSystemInfosStore()
import { useI18n } from 'vue-i18n'
const { t } = useI18n()

import formView from '@/components/forms/view.vue'
import type { FormItem } from '@/components/forms/form.types'
import type { TableInfos } from '@/commons/types/table.types'

import * as current from '@/services/users.services'
import * as login from '@/services/login.services'
import * as messages from '@/commons/utils/messages'

// name
defineOptions({
    name: 'app-users'
})

const pageInfos: TableInfos = reactive({
    columns: [
        {
            key: 'userno',
            dataIndex: 'userno',
            title: 'User No'
        },
        {
            key: 'ntAccount',
            dataIndex: 'ntAccount',
            title: 'NT Account'
        },
        {
            key: 'username',
            dataIndex: 'username',
            title: 'User Name'
        },
        {
            key: 'deptName',
            dataIndex: 'deptName',
            title: 'Department'
        },
        {
            key: 'email',
            dataIndex: 'email',
            title: 'Email'
        },
        {
            key: 'status',
            dataIndex: 'status',
            title: 'isActive'
        },
        {
            key: 'roles',
            dataIndex: 'roles',
            title: 'Roles'
        },
        {
            key: 'actions',
            dataIndex: 'actions',
            title: 'Actions'
        },
    ],
    rows: [] as any[],
    pagination: {
        pageIndex: 0,
        pageSize: 10,
        totalCount: 0,
    }
})

onMounted(() => {
    getlistData()
})

const formConfig = reactive({
    class: {
        forms: 'inline',
        items: 'col-4',
        label: 'hidden'
    },
    format: {
        date: 'YYYY-MM-DD',
        time: 'HH:mm:ss'
    }
})

// Search Form
const searchRef = ref();
const searchForms: Ref<FormItem[]> = ref([
    {
        type: 'input',
        key: 'userno',
        label: 'User No',
    },
    {
        type: 'input',
        key: 'username',
        label: 'User Name',
    },
    {
        type: 'input',
        key: 'ntAccount',
        label: 'NT Account',
    },
])
const searchInfos: any = ref({
    userno: '',
    username: '',
    ntAccount: '',
})
//
const search = () => {
    pageInfos.pagination.pageIndex = 0
    getlistData()
}
const getlistData = async () => {
    let params: any = {
        page: pageInfos.pagination.pageIndex + 1,
        size: pageInfos.pagination.pageSize,
        sort: '',
    }
    if (searchInfos.value.userno && searchInfos.value.userno != '')
        params.userno = 'match:' + searchInfos.value.userno
    if (searchInfos.value.username && searchInfos.value.username != '')
        params.username = 'match:' + searchInfos.value.username
    if (searchInfos.value.ntAccount && searchInfos.value.ntAccount != '')
        params.ntAccount = 'match:' + searchInfos.value.ntAccount
    //
    let resp: any = await current.getlistUsers(params)
    const { status, data, message } = resp;
    if (status) {
        const { pagination, items } = data
        pageInfos.rows = [...items]
        pageInfos.pagination.totalCount = pagination.totalCount
    } else {
        messages.showError(message)
    }
}

//#region User Modal
const userModal = ref(false)
const userConfig = reactive({
    class: {
        forms: '',
        items: '',
        label: 'col-12'
    },
    format: {
        date: 'YYYY-MM-DD',
        time: 'HH:mm:ss'
    },
    showError: true
})
const userRef = ref();
const userForms: Ref<FormItem[]> = ref([
    {
        type: 'input',
        key: 'userno',
        label: 'User No',
        required: true,
    },
    {
        type: 'input',
        key: 'ntAccount',
        label: 'NT Account',
        required: true,
    },
    {
        type: 'input',
        key: 'password',
        label: 'Password',
        isPassword: true,
        required: true,
        hidden: true,
    },
    {
        type: 'input',
        key: 'username',
        label: 'User Name',
        required: true,
    },
    {
        type: 'input',
        key: 'deptName',
        label: 'Department',
        required: true,
    },
    {
        type: 'input',
        key: 'email',
        label: 'Email',
        isEmail: true
    },
    {
        type: 'switch',
        key: 'status',
        label: 'isActive',
    },
    {
        type: 'select',
        key: 'roleIDs',
        label: 'Roles',
        list: [],
        isMulti: true
    },
])
const enum FormIndex {
    password = 2,
    roles = 7,
}
const userInfos: any = ref({
    userno: '',
    password: '',
    username: '',
    ntAccount: '',
    deptName: '',
    email: '',
    status: true,
    roleIDs: [],
})
const userInfo = reactive({
    action: 'New',
    id: '',
})
//
const clearUser = () => {
    userInfos.value = {
        userno: '',
        password: '',
        username: '',
        ntAccount: '',
        deptName: '',
        email: '',
        status: true,
        roleIDs: [],
    }
}
const getlistRoles = async () => {
    let resp: any = await current.getlistRoles()
    const { status, data, message } = resp;
    if (status) {
        roleInfo.rows = [...data]
        //
        let temp = data.map((a: any) => ({ value: a.id, label: a.roleName }))
        userForms.value[FormIndex.roles].list = temp
    } else {
        messages.showError(message)
    }
}
// Edit
const saveUser = async () => {
    if (!userRef.value?.validate()) return

    if (login.checkPassword(userInfos.value.password, userInfos.value.password) == -2) {
        messages.showError(t("message.password.notcom"))
        return;
    }

    let params = {
        ...userInfos.value,
        status: userInfos.value.status ? 1 : 0,
        email: userInfos.value.email || '',
        avatar: ""
    }
    userInfo.action == "New" ?
        Object.assign(params, { id: '' }) :
        Object.assign(params, { id: userInfo.id })
    //
    let resp: any = await current.saveUser(params)
    const { status, data, message } = resp;
    if (status) {
        messages.showSuccess(t("message.saved"))
        getlistData()
        //
        userModal.value = false
    } else {
        messages.showError(message)
    }
}
const resetPassword = async (values: any) => {
    const params = {
        id: values.id
    }
    let resp: any = await current.resetPassword(params)
    const { status, data } = resp;
    if (status) {
        messages.showConfirm({
            title: t("message.password.new"),
            message: data
        }, () => { })
    }
}
const deleteUser = async (values: any) => {
    const params = { id: values.id }
    let resp: any = await current.deleteUser(params)
    const { status, data, message } = resp;
    if (status) {
        messages.showSuccess(t("message.deleted"))
        getlistData()
    } else {
        messages.showError(message)
    }
}
//#endregion

//#region Role
const roleModal = ref(false)
//
const roleConfig = reactive({
    class: {
        forms: 'inline',
        items: 'col-6',
        label: 'hidden'
    },
    format: {
        date: 'YYYY-MM-DD',
        time: 'HH:mm:ss'
    },
    showError: false
})
const roleRef = ref();
const roleForms: Ref<FormItem[]> = ref([
    {
        type: 'input',
        key: 'roleName',
        label: 'Role Name',
        required: true,
    },
    {
        type: 'input',
        key: 'remark',
        label: 'Remark',
    },
])
const roleInfos: any = ref({
    roleName: '',
    remark: '',
})
//
const roleInfo: any = reactive({
    columns: [
        {
            key: 'roleName',
            dataIndex: 'roleName',
            title: 'Role Name'
        },
        {
            key: 'remark',
            dataIndex: 'remark',
            title: 'Remark'
        },
        {
            key: 'count',
            dataIndex: 'count',
            title: 'Assigned Users'
        },
        {
            key: 'actions',
            dataIndex: 'actions',
            title: 'Actions'
        },
    ],
    rows: []
})
//
const saveRole = async () => {
    if (!roleRef.value?.validate()) return

    const params = {
        ...roleInfos.value,
        id: "",
    }
    let resp: any = await current.saveRole(params)
    const { status, data, message } = resp;
    if (status) {
        messages.showSuccess(t("message.saved"))
        getlistRoles()
        //
        roleInfos.value = {
            roleName: '',
            remark: '',
        }
    } else {
        messages.showError(message)
    }
}
const deleteRole = async (values: any) => {
    const params = {
        id: values.id
    }
    let resp: any = await current.deleteRole(params)
    const { status, data, message } = resp;
    if (status) {
        messages.showSuccess(t("message.deleted"))
        getlistRoles()
        //
        getlistData()
    } else {
        messages.showError(message)
    }
}
//#endregion

// Modal
const showModal = (action: string, values: any) => {
    switch (action) {
        case 'add': {
            userInfo.action = "New"
            //
            userInfo.id = ''
            userForms.value[FormIndex.password].hidden = false
            clearUser()
            //
            getlistRoles()
            //
            userModal.value = true
            break
        }
        case 'update': {
            userInfo.action = "Update"
            //
            userInfo.id = values.id
            userForms.value[FormIndex.password].hidden = true
            clearUser()
            //
            Object.assign(userInfos.value, values)
            userInfos.value.roleIDs = values.roles.map((a: any) => a.id)
            getlistRoles()
            //
            userModal.value = true
            break
        }
        case 'roles': {
            getlistRoles()
            //
            roleModal.value = true
            break
        }
        default: {
            break
        }
    }
}
</script>

<template>
    <div class="sections">
        <div class="section-header">
            <h4 class="titles">{{ $t('user.title') }}</h4>
            <h5 class="sub-titles">{{ $t('user.desc') }}</h5>
        </div>
        <div class="section-contents">
            <div class="box-bar">
                <div class="header">
                    {{ $t('user.allUsers') }}
                    <span class="header-infos">{{ pageInfos.pagination.totalCount }}</span>
                </div>
                <div class="tools">
                    <div class="box-search">
                        <formView ref="searchRef" :config="formConfig" :forms="searchForms"
                            v-model:values="searchInfos">
                        </formView>
                        <a-button type="default" @click="search">
                            <i class="fa-solid fa-magnifying-glass"></i> {{ $t('btn.search') }}
                        </a-button>
                    </div>
                    <!-- <a-button type="default" @click="search">
                        <i class="fa-solid fa-filter"></i> Filters
                    </a-button> -->
                    <a-button type="primary" @click="showModal('add', {})">
                        <i class="fa-solid fa-plus"></i> {{ $t('user.addUser') }}
                    </a-button>
                    <a-button type="primary" @click="showModal('roles', {})">
                        <i class="fa-solid fa-gear"></i> {{ $t('user.roleConfig') }}
                    </a-button>
                </div>

            </div>
            <div class="box-table box-shadow">
                <a-table :columns="pageInfos.columns" :data-source="pageInfos.rows">
                    <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'status'">
                            <div v-if="record.status" class="item-status status-success">
                                {{ $t('form.active') }}
                            </div>
                            <div v-else class="item-status status-default">
                                {{ $t('form.inactive') }}
                            </div>
                        </template>
                        <template v-if="column.key === 'roles'">
                            <div class="list-roles">
                                <template v-for="role in record.roles">
                                    <div class="role-item">{{ role.roleName }}</div>
                                </template>
                            </div>
                        </template>
                        <template v-if="column.key === 'actions'">
                            <div class="btns">
                                <a-tooltip>
                                    <template #title>{{ $t('btn.edit') }}</template>
                                    <a-button type="default" @click="showModal('update', record)">
                                        <i class="fa-solid fa-edit"></i>
                                    </a-button>
                                </a-tooltip>
                                <a-tooltip>
                                    <template #title>{{ $t('btn.change_password') }}</template>
                                    <a-popconfirm title="Are you sure reset password for this user?" ok-text="Yes"
                                        cancel-text="No" @confirm="resetPassword(record)">
                                        <a-button type="default">
                                            <i class="fa-solid fa-key"></i>
                                        </a-button>
                                    </a-popconfirm>
                                </a-tooltip>
                                <a-tooltip>
                                    <template #title>{{ $t('btn.delete') }}</template>
                                    <a-popconfirm title="Are you sure delete this user?" ok-text="Yes" cancel-text="No"
                                        @confirm="deleteUser(record)">
                                        <a-button type="default">
                                            <i class="fa-solid fa-trash"></i>
                                        </a-button>
                                    </a-popconfirm>
                                </a-tooltip>
                            </div>
                        </template>
                    </template>
                </a-table>
            </div>
        </div>
    </div>

    <!-- 编辑窗口 -->
    <a-modal v-model:open="userModal" :title="`${userInfo.action} User`" @ok="saveUser">
        <formView ref="userRef" :config="userConfig" :forms="userForms" v-model:values="userInfos">
        </formView>
    </a-modal>

    <!-- 角色信息 -->
    <a-modal v-model:open="roleModal" :title="$t('user.rolelist')" width="60vw" :footer="[]">
        <div class="role-modal">
            <div class="box-table">
                <a-table :columns="roleInfo.columns" :data-source="roleInfo.rows" :pagination="false">
                    <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'count'">
                            <span>{{ record.users.length }}</span>
                        </template>
                        <template v-if="column.key === 'actions'">
                            <div class="btns">
                                <template v-if="record.roleName === systemInfosStore.infos.adminKey">
                                    <a-button type="default" disabled class="btn btn-tools">
                                        <i class="fa-solid fa-lock"></i>
                                    </a-button>
                                </template>
                                <a-popconfirm v-else title="Are you sure delete this role?" ok-text="Yes"
                                    cancel-text="No" @confirm="deleteRole(record)">
                                    <a-button type="default" class="btn btn-tools">
                                        <i class="fa-solid fa-trash"></i>
                                    </a-button>
                                </a-popconfirm>
                            </div>
                        </template>
                    </template>
                </a-table>
            </div>
            <div class="box-forms">
                <formView ref="roleRef" :config="roleConfig" :forms="roleForms" v-model:values="roleInfos">
                </formView>
                <a-button type="primary" @click="saveRole">{{ $t('btn.save') }}</a-button>
            </div>
        </div>
    </a-modal>
</template>

<style scoped lang="scss">
.sections {
    position: relative;
    background-size: 1050px;
    background-position: -9px 22px;

    .section-header {
        padding: 10px;

        .titles {
            padding: 10px 0;
            font-size: 21px;
            font-weight: 700;
        }

        .sub-titles {
            font-size: 14px;
        }
    }

    .section-contents {
        display: flex;
        flex-direction: column;
    }
}

.box-bar {
    padding: 10px;
    border-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .header {
        font-size: 1.1rem;

        .header-infos {
            color: #747474;
        }
    }

    .tools {
        display: flex;
        align-items: center;
        gap: 15px;
    }

    .box-search {
        display: flex;
    }
}

.item-status {
    padding: 3px 10px;
    width: max-content;
    border-radius: 5px;

    &.status-success {
        color: #fff;
        background: var(--color-success);
    }

    &.status-default {
        color: #0000006d;
        background: var(--color-gray);
    }
}

.list-roles {
    display: flex;
    gap: 8px;

    .role-item {
        padding: 5px 10px;
        font-size: 14px;
        font-weight: 700;
        border-radius: 4px;
        background: rgba(195, 206, 207, 0.5529411765);
    }
}

.role-modal {
    .box-forms {
        margin-top: 5px;
        padding-top: 15px;
        border-top: 1px solid #c4cecf8d;
        display: flex;
    }
}
</style>
