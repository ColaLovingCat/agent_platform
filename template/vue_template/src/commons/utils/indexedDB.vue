<script lang="ts" setup>
import { onMounted, ref } from 'vue'

import { IndexedDBWrapper } from '@/commons/utils/indexedDB'

// name
defineOptions({
    name: 'test-indexdb'
})

let indexDB: IndexedDBWrapper
let datas: any = ref([])
const columns = [
    { key: "id", title: "ID" },
    { key: "name", title: "Name" },
    { key: "age", title: "Age" },
]

onMounted(async () => {
    await createDB()
    await getlistData()
})

const createDB = async () => {
    // 定义数据库
    indexDB = new IndexedDBWrapper("MyAppDB", 1, [
        {
            name: "users",
            keyPath: "id",
            autoIncrement: true,
            indexes: [{ name: "by_name", keyPath: "name" }],
        },
    ]);
    await indexDB.openDB()
}

const getlistData = async () => {
    datas.value = await indexDB.getlistData("users");
}

const addUser = async () => {
    await indexDB.saveData("users", { name: "Alice", age: 20 });
    await getlistData()
}

const updateUser = async (id: number) => {
    const user: any = await indexDB.getinfoData("users", id)
    if (!user) return
    await indexDB.saveData("users", { ...user, age: (user.age || 20) + 1 })
    await getlistData()
}

const deleteUser = async (id: number) => {
    await indexDB.deleteData("users", id);
    await getlistData()
}

const clearUser = async () => {
    await indexDB.clearTable("users");
    await getlistData()
}
</script>

<template>
    <div class="sections">
        <div class="btns">
            <a-button @click="getlistData">getlistData</a-button>
            <a-button @click="addUser">addUser</a-button>
            <a-button @click="clearUser">clearUser</a-button>
        </div>
        <div class="box-table">
            <table class='table'>
                <thead>
                    <tr>
                        <th v-for="col in columns">{{ col.title }}</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in datas">
                        <td v-for="col in columns">{{ row[col.key] }}</td>
                        <td>
                            <div class="btns">
                                <a-button @click="updateUser(row.id)">Update</a-button>
                                <a-button @click="deleteUser(row.id)">Delete</a-button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<style scoped lang="scss"></style>
