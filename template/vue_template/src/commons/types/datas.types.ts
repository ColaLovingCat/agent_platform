export interface SystemInfos {
  name: string; // 系统名称
  loginMode: "sso-only" | "sso-iuser" | "sso-local";
  //
  azure: "request" | "configs"; // 获取sso配置方式
  azureAuto: boolean; // 自动SSO
  azureConfigs: {
    host: string;
    client_id: string;
    scope: string;
    response_type: string;
    redirect_uri?: string;
  };
  adminKey: string; // 系统管理员角色名
}

export interface MenuInfos {
  index: number | string;
  key: string;
  icon?: string;
  title: string;
  lang: string;
  path: string;
  infos?: any;
  children?: MenuInfos[];
}
export class MenuClass {
  index?: number | string = "";
  key?: string = "";
  icon?: string = "";
  title?: string = "";
  lang?: string = "";
  path?: string = "";
  children?: MenuInfos[] = [];
}

export interface UserInfos {
  id?: string;
  userno: string;
  ntAccount?: string;
  username: string;
  password?: string;
  email?: string;
  avatar?: string;
  deptID?: string;
  deptName?: string;
  status?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  roles?: string | Array<string> | null;
}
