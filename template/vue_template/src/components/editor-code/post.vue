<script lang="ts" setup>
import { ref } from "vue";

import codeView from "@/components/editor-code/view.vue";
import uploadView from "@/components/upload-form/view.vue";

import * as extend from "@/commons/utils/extends";
import { fetchRequest } from "@/commons/utils/fetch";

// name
defineOptions({
  name: "post-api",
});

const url = ref("https://szhlinvma75.apac.bosch.com:59193/api/upload");
const pageInfos: any = ref({
  method: "POST",
  data: JSON.stringify({ userno: "", username: "", ntAccount: "" }, null, 2),
  isBlob: false,
});
const respCode: any = ref({});
const respTxt = ref("");

const send = async () => {
  try {
    const options: any = {
      method: pageInfos.value.method,
      data:
        pageInfos.value.data == "" ? null : JSON.parse(pageInfos.value.data),
      activeBody: true,
    };
    // 下载文件流
    if (pageInfos.value.isBlob) options.dataType = "blob";
    //
    console.log("[API] opts: ", options);
    extend.ExLocalStore.set(
      "token",
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJuYW1laWQiOiJkNzMwNjhmNS00MDdlLTRmNzEtOTllNC01MTM3ZTIyMjQ5ZmYiLCJ1c2Vybm8iOiIxMjM0NTY3OCIsInVzZXJOYW1lIjoiVGVzdFVzZXIiLCJudEFjY291bnQiOiIxMjM0NTY3OCIsIm5iZiI6MTc1ODg2MzM5OSwiZXhwIjoxNzU4ODkyMTk5LCJpYXQiOjE3NTg4NjMzOTksImlzcyI6IkRhdGFMaW5rIn0.pdCsnaque3hhiIrIL4EF8SVDWgDp1086cQ2BS3tvzJk"
    );
    let resp: any = await fetchRequest(url.value, options);
    console.log("[API] resp: ", resp);
    //
    if (pageInfos.value.isBlob) {
      let filename = `export_${extend.ExDate.format(
        new Date(),
        "yyyyMMddHHmmss"
      )}.xlsx`;
      const disposition = resp.headers["content-disposition"];
      if (disposition) {
        const match = disposition.match(/filename=([^;]+)/);
        if (match && match[1]) {
          filename = decodeURIComponent(match[1]);
        }
      }
      //
      const url = window.URL.createObjectURL(resp.body);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
    } else {
      respCode.value = resp.code;
      respTxt.value = JSON.stringify(resp.body, null, 2);
    }
  } catch (error) {
    respCode.value = 500;
    respTxt.value = JSON.stringify({ error: error }, null, 2);
  }
};

const clear = () => {
  respTxt.value = "";
};

const uploaded = (event: any) => {
  respTxt.value = JSON.stringify(event, null, 2);
};
</script>

<template>
  <div class="forms">
    <label for="">Request</label>
    <div class="box-datas">
      <div class="left">
        <div class="form-item">
          <div class="item-controls">
            <a-select v-model:value="pageInfos.method" style="width: 120px">
              <a-select-option value="GET">GET</a-select-option>
              <a-select-option value="POST">POST</a-select-option>
            </a-select>
            <a-input v-model:value="url" placeholder="path" />
          </div>
        </div>
        <div class="form-item">
          <codeView
            style="height: 200px"
            v-model:value="pageInfos.data"
          ></codeView>
        </div>
      </div>
      <div class="right">
        <uploadView
          :host="url"
          :data="JSON.parse(pageInfos.data)"
          @uploaded="uploaded"
        ></uploadView>
      </div>
    </div>
    <div class="btns">
      <a-button type="primary" @click="send">Send</a-button>
      <a-button type="default" @click="clear">Clear</a-button>
    </div>
    <div class="form-item">
      <label for="">Response ({{ respCode.status }})</label>
      <div class="box-datas">
        <div class="left">
          <codeView style="height: 500px" v-model:value="respTxt"></codeView>
        </div>
        <div class="right">
          <a-switch v-model:checked="pageInfos.isBlob" /> 返回为文件流
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.forms {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;

  .box-datas {
    display: flex;
    gap: 20px;

    .left {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .right {
      width: 300px;
      height: 240px;
    }
  }

  .form-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  label {
    font-size: 18px;
    font-weight: 700;
  }

  .item-controls {
    display: flex;
  }
}
</style>
