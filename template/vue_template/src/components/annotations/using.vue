<script lang="ts" setup>
import { onMounted, ref, reactive, computed, watch } from 'vue'

import labelView from './view.vue'

// name
defineOptions({
  name: 'label-using'
})

onMounted(() => { })

const imgUrl = ref('https://szhlinvma75.apac.bosch.com:59108/uploads/fd6cf340-31a4-43ef-8819-d065da430212_img17.jpg')
const shapes: any = ref([
  {
    "id": "be754928-8632-4e35-b0c6-16fdd79a37da",
    "type": "rect",
    "x": 166,
    "y": 94,
    "w": 603,
    "h": 320,
    "strokeWidth": 4,
    "stroke": "#f00",
    "infos": {
      "remark": "12a",
      "activeColor": true
    }
  }
])

const categorys: any = reactive([
  'MCU', 'PDU'
])
</script>

<template>
  <div class="sections">
    <div class="box-draw">
      <labelView mode="edit" :img-url="imgUrl" v-model:shapes="shapes">
        <template #infos="{ value, onChange }">
          <div class="form-item">
            <a-switch v-model:checked="value.infos.activeColor" @change="onChange(value)" />
            <span>Color?</span>
          </div>
          <a-textarea placeholder="备注" :rows="4" v-model:value="value.infos.remark" @change="onChange(value)" />
        </template>
      </labelView>
    </div>
    <div class="list-shapes">
      <template v-for="item in shapes">
        <div class="shape-item">
          <p>{{ item.id }}</p>
          <p>{{ item.infos.activeColor }}</p>
          <p>{{ item.infos.remark }}</p>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sections {
  display: flex;

  .list-shapes {
    width: 300px;
  }

  .box-draw {
    flex: 1;
    overflow: auto;
  }
}

.form-item {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
