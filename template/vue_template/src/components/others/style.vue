<script lang="ts" setup>
import { onMounted, ref } from 'vue';

// name
defineOptions({
    name: 'custom-name'
})

const columns = ref([
    { key: 'cname', title: 'Name' },
    { key: 'date', title: 'Date' },
    { key: 'email', title: 'Email' },
    { key: 'url', title: 'Url' },
])
const datas: any = ref([])
onMounted(async () => {
    const resp = await fetch('/mocks/user/list?size=10');
    const data = await resp.json();
    datas.value = data.result.list
})
</script>

<template>
    <div class="sections">
        <div class="box box-shadow">
            <div class="box-header">
                <h4 class="titles">Title</h4>
            </div>
            <div class="box-contents">
                <table class='table'>
                    <thead>
                        <tr>
                            <th v-for="col in columns">{{ col.title }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in datas">
                            <td v-for="col in columns">{{ row[col.key] }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="box-footer">
                <a-button type="primary">Save</a-button>
            </div>
        </div>
    </div>
</template>

<style scoped lang="scss"></style>
