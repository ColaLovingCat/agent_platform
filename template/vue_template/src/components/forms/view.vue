<script lang="ts" setup>
import { onMounted, reactive, ref, watch, watchEffect } from 'vue'
import dayjs from 'dayjs'
import type { FormItem } from '@/components/forms/form.types';

// name
defineOptions({
  name: 'app-form'
})

// props
const props = defineProps({
  // 表单配置项（样式类名、格式化等）
  config: {
    type: Object,
    default: () => ({
      class: {
        forms: '',
        items: '',
        label: '',
      },
      format: {
        date: 'YYYY-MM-DD',
        time: 'HH:mm:ss'
      },
      showError: false
    })
  },
  // 表单项结构定义
  forms: {
    type: Array<FormItem>,
    default: () => []
  },
  // 初始值对象
  values: {
    type: Object,
    default: () => ({})
  },
  changeMark: {
    type: Boolean,
    require: false
  },
})

// 抛出值的双向绑定
const emit = defineEmits(['update:values', 'changed'])

const formValues: any = reactive({})

onMounted(() => {
  // 初始挂载时刷新表单值
  refreshValues(props.values)
})
// 监听外部传入值变化，更新内部值（深度监听）
watch(() => props.values, (newVal) => {
  refreshValues(newVal)
}, { deep: true })
// 将外部传入值转换为响应式内部值，并处理时间格式
const refreshValues = (values: any) => {
  Object.keys(values).forEach((key) => {
    const temp = props.forms.find((a: any) => a.key === key)
    const value = values[key]
    if (temp) {
      switch (temp.type) {
        case 'date':
        case 'datetime': {
          if (value) {
            formValues[key] = dayjs(value);
          } else {
            formValues[key] = null
          }
          break
        }
        case 'date-range':
        case 'datetime-range': {
          if (value && value.length == 2) {
            formValues[key] = [dayjs(value[0]), dayjs(value[1])];
          } else {
            formValues[key] = []
          }
          break
        }
        default: {
          formValues[key] = value;
          break
        }
      }
    }
  });
}

// 单值发生变更时触发
const onChanged = (form: any, event?: any) => {
  // 验证单个控件
  validateItem(form)
  //
  syncValues()
  emit('changed', form.key)
}
const onCustomChange = (form: any, newValue: any) => {
  formValues[form.key] = newValue
  onChanged(form)
}
// 将内部值同步格式化并 emit 给外部
const syncValues = () => {
  let values = JSON.parse(JSON.stringify(formValues))
  props.forms.map((form: any) => {
    switch (form.type) {
      case 'date': {
        if (values[form.key]) {
          values[form.key] = dayjs(values[form.key]).format(props.config.format.date)
        }
        break
      }
      case 'datetime': {
        if (values[form.key]) {
          values[form.key] = dayjs(values[form.key]).format(`${props.config.format.date} ${props.config.format.time}`)
        }
        break
      }
      case 'date-range': {
        if (values[form.key] && values[form.key].length == 2) {
          values[form.key] = [
            dayjs(values[form.key][0]).format(props.config.format.date),
            dayjs(values[form.key][1]).format(props.config.format.date)
          ]
        }
        break
      }
      case 'datetime-range': {
        if (values[form.key] && values[form.key].length == 2) {
          values[form.key] = [
            dayjs(values[form.key][0]).format(`${props.config.format.date} ${props.config.format.time}`),
            dayjs(values[form.key][1]).format(`${props.config.format.date} ${props.config.format.time}`)
          ]
        }
        break
      }
      default: {
        break
      }
    }
  })
  emit('update:values', values)
}

// 下拉选择搜索过滤器
const filterOption = (input: string, option: any) => {
  return option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
};

// 表单验证逻辑
const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
const multiEmailRegex = /^([\w.-]+@[\w.-]+\.\w+)(;[\w.-]+@[\w.-]+\.\w+)*$/;
const errorInfos: any = ref({});
const validate = () => {
  // 清空之前的错误信息
  errorInfos.value = {};
  //
  let isValid = true;
  for (const form of props.forms) {
    if (!validateItem(form)) {
      isValid = false;
    }
  }
  return isValid;
}
const validateItem = (form: any) => {
  let isValid = true
  const value = formValues[form.key];

  // 激活状态 且 必填
  if (!(form.disabled || isHidden(form)) && form.required) {
    // 多选
    if (form.type === 'checks') {
      isValid = value && value.length > 0
      if (!isValid) {
        errorInfos.value[form.key] = `${form.label} required`;
      }
    }

    // 空值
    isValid = !checkEmpty(value)
    if (!isValid) {
      errorInfos.value[form.key] = `${form.label} required`;
    }
  }

  // 邮件
  if (form.isEmail && !checkEmpty(value)) {
    isValid = multiEmailRegex.test(value.trim());
    if (!isValid) {
      errorInfos.value[form.key] = 'Invalid email format (a@b.com or a@b.com;b@c.com)';
    }
  }

  // 通过
  if (isValid) {
    delete errorInfos.value[form.key];
  }
  return isValid
}

// 判断值是否为空
const checkEmpty = (value: any) => {
  return value === '' || value == null || (Array.isArray(value) && value.length === 0)
}

// 联动隐藏对应控件（支持函数或布尔值）
const isHidden = (form: FormItem) => {
  if (typeof form.hidden === 'function') {
    return form.hidden(formValues)
  }
  return !!form.hidden
}
// 清空对应的值
const setEmpty = (formKey: string) => {
  const form = props.forms.find((f) => f.key === formKey)
  if (!form) return

  switch (form.type) {
    case 'checks':
    case 'date-range':
    case 'datetime-range':
      formValues[formKey] = []
      break

    case 'switch':
      formValues[formKey] = false
      break

    default:
      formValues[formKey] = null
  }
}

// 联动隐藏字段时自动清空其值
watchEffect(() => {
  props.forms.forEach((form) => {
    const shouldHide = isHidden(form)
    if (shouldHide && !checkEmpty(formValues[form.key])) {
      setEmpty(form.key)
    }
  })
})

// 暴露验证方法
defineExpose({
  validate
})
</script>

<template>
  <div class="forms" :class="config.class.forms">
    <template v-for="form in forms" :key="form.key">
      <!-- Form Item -->
      <div class="form-item" v-if="!isHidden(form)" :class="`item-${form.key} ${config.class.items}`">
        <!-- Label -->
        <label :class="config.class.label" :for="form.key">
          {{ form.label }}
          <span v-if="form.required" class="required">*</span>
        </label>

        <div class="form-comp">
          <!-- Input -->
          <template v-if="form.type == 'input'">
            <!-- Password -->
            <template v-if="form.isPassword">
              <a-input-password style="width: 100%;" :id="form.key"
                :placeholder="form.placeholder ? form.placeholder : form.label" v-model:value="formValues[form.key]"
                @change="onChanged(form)" :disabled="form.disabled" :status="errorInfos[form.key] ? 'error' : ''" />
            </template>
            <!-- Number -->
            <template v-else-if="form.isNumber">
              <a-input-number style="width: 100%;" :id="form.key"
                :placeholder="form.placeholder ? form.placeholder : form.label" v-model:value="formValues[form.key]"
                @change="onChanged(form)" :disabled="form.disabled" :status="errorInfos[form.key] ? 'error' : ''" />
            </template>
            <!-- Email -->
            <template v-else-if="form.isEmail">
              <a-input style="width: 100%;" :id="form.key"
                :placeholder="form.placeholder ? form.placeholder : form.label" v-model:value="formValues[form.key]"
                @change="onChanged(form)" :disabled="form.disabled" :allowClear="form.activeClear"
                :status="errorInfos[form.key] ? 'error' : ''" />
            </template>
            <!-- Normal -->
            <template v-else>
              <a-input style="width: 100%;" :id="form.key"
                :placeholder="form.placeholder ? form.placeholder : form.label" v-model:value="formValues[form.key]"
                @change="onChanged(form)" :disabled="form.disabled" :allowClear="form.activeClear"
                :status="errorInfos[form.key] ? 'error' : ''" />
            </template>
          </template>
          <!-- Textarea -->
          <template v-if="form.type == 'textarea'">
            <a-textarea style="width: 100%;" :id="form.key"
              :placeholder="form.placeholder ? form.placeholder : form.label" v-model:value="formValues[form.key]"
              @change="onChanged(form)" :disabled="form.disabled" :allowClear="form.activeClear"
              :status="errorInfos[form.key] ? 'error' : ''" />
          </template>

          <!-- Select -->
          <template v-if="form.type == 'select'">
            <a-select style="width: 100%;" :id="form.key" :mode="form.isMulti ? 'multiple' : undefined"
              :placeholder="form.placeholder ? form.placeholder : form.label" v-model:value="formValues[form.key]"
              @change="onChanged(form)" :disabled="form.disabled" :allowClear="form.activeClear"
              :show-search="form.activeSearch" :filter-option="filterOption"
              :status="errorInfos[form.key] ? 'error' : ''">
              <a-select-option v-for="option in form.list" :key="option.value" :value="option.value"
                :label="option.label">
                {{ option.label }}
              </a-select-option>
            </a-select>
          </template>

          <!-- Switch -->
          <template v-if="form.type == 'switch'">
            <div style="width: 100%;">
              <a-switch :id="form.key" v-model:checked="formValues[form.key]" @change="onChanged(form)"
                :disabled="form.disabled" />
            </div>
          </template>

          <!-- Radio -->
          <template v-if="form.type == 'radios'">
            <a-radio-group style="width: 100%;" :id="form.key" :name="form.key" v-model:value="formValues[form.key]"
              @change="onChanged(form)" :disabled="form.disabled">
              <a-radio v-for="option in form.list" :key="option.label" :value="option.value">
                <span v-if="errorInfos[form.key]" style="color: red">{{ option.label }}</span>
                <span v-else>{{ option.label }}</span>
              </a-radio>
            </a-radio-group>
          </template>
          <!-- Checks -->
          <template v-if="form.type == 'checks'">
            <a-checkbox-group style="width: 100%;" :id="form.key" :name="form.key" v-model:value="formValues[form.key]"
              @change="onChanged(form)" :disabled="form.disabled">
              <a-checkbox v-for="option in form.list" :key="option.label" :value="option.value">
                <span v-if="errorInfos[form.key]" style="color: red">{{ option.label }}</span>
                <span v-else>{{ option.label }}</span>
              </a-checkbox>
            </a-checkbox-group>
          </template>

          <!-- Date -->
          <template v-if="form.type == 'date'">
            <a-date-picker style="width: 100%;" :id="form.key" :format="props.config.format.date"
              v-model:value="formValues[form.key]" @change="onChanged(form)" :disabled="form.disabled"
              :allowClear="form.activeClear" :status="errorInfos[form.key] ? 'error' : ''" />
          </template>
          <!-- Datetime -->
          <template v-if="form.type == 'datetime'">
            <a-date-picker style="width: 100%;" :id="form.key"
              :format="props.config.format.date + ' ' + props.config.format.time"
              :show-time="{ format: props.config.format.time }" v-model:value="formValues[form.key]"
              @change="onChanged(form)" :disabled="form.disabled" :allowClear="form.activeClear"
              :status="errorInfos[form.key] ? 'error' : ''" />
          </template>
          <!-- Date Range -->
          <template v-if="form.type == 'date-range'">
            <a-range-picker style="width: 100%;" :id="form.key" :format="props.config.format.date"
              v-model:value="formValues[form.key]" @change="onChanged(form)" :disabled="form.disabled"
              :allowClear="form.activeClear" :status="errorInfos[form.key] ? 'error' : ''" />
          </template>
          <!-- Datetime Range -->
          <template v-if="form.type == 'datetime-range'">
            <a-range-picker style="width: 100%;" :id="form.key"
              :format="props.config.format.date + ' ' + props.config.format.time"
              :show-time="{ format: props.config.format.time }" v-model:value="formValues[form.key]"
              @change="onChanged(form)" :disabled="form.disabled" :allowClear="form.activeClear"
              :status="errorInfos[form.key] ? 'error' : ''" />
          </template>

          <!-- 自定义 slot -->
          <template v-if="form.type === 'custom'">
            <slot :name="form.key" :value="formValues[form.key]" :onChange="(val: any) => onCustomChange(form, val)">
            </slot>
          </template>

          <!-- Error -->
          <div class="error-infos" v-if="config.showError">{{ errorInfos[form.key] }}</div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@import url(./styles.scss);
</style>
