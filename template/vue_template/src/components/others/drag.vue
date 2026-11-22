<script setup>
import { ref } from "vue";
import draggable from "vuedraggable";

const list1 = ref([
    { name: "组件1", id: 1, content: "内容内容内容。。。。" },
    { name: "组件2", id: 2, content: "内容内容内容。。。。" },
    { name: "组件3", id: 3, content: "内容内容内容。。。。" },
    { name: "组件4", id: 4, content: "内容内容内容。。。。" },
    { name: "组件5", id: 5, content: "内容内容内容。。。。" },
    { name: "组件6", id: 6, content: "内容内容内容。。。。" },
    { name: "组件7", id: 7, content: "内容内容内容。。。。" }
]);

const list2 = ref([]);
const activeNames = ref([]);
const count = ref(0);

const log = (evt) => {
    if (evt.added) {
        count.value += 1;
        const item = evt.added.element;
        const idx = list2.value.findIndex(e => e.id === item.id);
        if (idx !== -1) {
            const temp = JSON.parse(JSON.stringify(list2.value));
            temp[idx].id = count.value;
            list2.value = temp;
        }
    }
};

const deleteItem = (index) => {
    list2.value.splice(index, 1);
};
</script>

<template>
    <div class="sections">
        <div class="col-5">
            <h3>组件配置页面展示</h3>
            <draggable tag="el-collapse" class="dragArea list-group" :list="list2" group="comp" @change="log">
                <template #item="{ element, index }">
                    <el-collapse class="list-group-item left" v-model="activeNames">
                        <el-collapse-item :name="element.id">
                            <span>步骤{{ (index + 1) }}</span>
                            <div style="margin-top: 10px;">
                                <p>{{ element.name }}</p>
                                <p>{{ element.content }}</p>
                            </div>
                        </el-collapse-item>
                    </el-collapse>
                </template>
            </draggable>
        </div>

        <div class="col-5">
            <h3>可用组件列表</h3>
            <draggable class="dragArea list-group" :list="list1" :group="{ name: 'comp', pull: 'clone', put: false }"
                @change="log">
                <template #item="{ element }">
                    <div class="list-group-item">{{ element.name }}</div>
                </template>
            </draggable>
        </div>
    </div>
</template>


<style>
.sections {
    width: 100%;
    display: flex;
    gap: 20px;
}

.col-5 {
    flex: 1;
}

.list-group {
    min-height: calc(100vh - 200px);
    background: #c4cecf2d;
    display: flex;
    flex-direction: column;
}

.list-group-item:first-child {
    border-top-left-radius: 0.25rem;
    border-top-right-radius: 0.25rem;
}

.list-group-item {
    position: relative;
    display: block;
    padding: 0.75rem 1.25rem;
    margin-bottom: -1px;
    background-color: #fff;
    border: 1px solid rgba(0, 0, 0, 0.125);
    box-sizing: border-box;
}

.el-collapse-item__header {
    border: 0;
    height: 40px;
    line-height: 40px;
}

.el-collapse-item__wrap {
    border-bottom: 0;
}

.list-group-item {
    cursor: move;
}

h3 {
    font-size: 28px;
    margin-bottom: 20px;
}

.el-icon-circle-close {
    color: #c9a2a2;
    font-size: 20px;
    position: absolute;
    right: 50px;
}

.el-icon-circle-close:hover {
    color: #f40;
}
</style>
