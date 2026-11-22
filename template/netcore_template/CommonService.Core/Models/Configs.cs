namespace CommonService.Core.Models
{
    public class AppSettings
    {
        public string Mode { get; set; }
        public string Protocol { get; set; }
        public string Hostname { get; set; }
        public string Port { get; set; }
        /// <summary>
        /// 本地用户列表 JSON 路径（相对 ContentRoot 或绝对路径），默认 Data/local-users.json
        /// </summary>
        public string LocalUsersPath { get; set; } = "Data/local-users.json";
    }

    public class AzureSettings
    {
        public string Host { get; set; }
        public string ClientID { get; set; }
        public string Scope { get; set; }
        public string ResponseType { get; set; }
        public string ClientSecret { get; set; }
    }

    public class iUserSettings
    {
        public string Host { get; set; }
    }

    public class JwtSettings
    {
        public string Issuer { get; set; } = string.Empty;
        public string Audience { get; set; } = string.Empty;
        public string SecretKey { get; set; } = string.Empty;
        public int ExpireMinutes { get; set; } = 60;
    }

    public class UploadSettings
    {
        public string Path { get; set; }

        public string MaxFileSize { get; set; } = "10MB";
        public long MaxFileSizeBytes
        {
            get
            {
                if (MaxFileSize.EndsWith("MB"))
                    return long.Parse(MaxFileSize.Replace("MB", "")) * 1024 * 1024;
                if (MaxFileSize.EndsWith("KB"))
                    return long.Parse(MaxFileSize.Replace("KB", "")) * 1024;
                return long.Parse(MaxFileSize);
            }
        }
    }

    /// <summary>
    /// 门户静态微应用：MetaRoot = wwwroot/_versions（registry + zip）；DeployRoot = wwwroot/apps/{id}
    /// </summary>
    public class PortalAppsSettings
    {
        /// <summary>
        /// 元数据根目录：registry.json 与 {id}/{version}.zip。默认 wwwroot/_versions
        /// </summary>
        public string MetaRoot { get; set; } = "wwwroot/_versions";

        /// <summary>
        /// 线上解压目录（{id}/ 静态文件），默认 wwwroot/apps
        /// </summary>
        public string DeployRoot { get; set; } = "wwwroot/apps";

        /// <summary>
        /// 注册表文件名（位于 MetaRoot 下）
        /// </summary>
        public string RegistryFileName { get; set; } = "registry.json";

        public string MaxZipSize { get; set; } = "50MB";

        public long MaxZipSizeBytes
        {
            get
            {
                if (MaxZipSize.EndsWith("MB", StringComparison.OrdinalIgnoreCase))
                    return long.Parse(MaxZipSize[..^2].Trim()) * 1024 * 1024;
                if (MaxZipSize.EndsWith("KB", StringComparison.OrdinalIgnoreCase))
                    return long.Parse(MaxZipSize[..^2].Trim()) * 1024;
                return long.Parse(MaxZipSize);
            }
        }

        /// <summary>
        /// 可选：在 MetaRoot 下再建子目录存放 zip。留空则 zip 直接放 MetaRoot/{id}/{version}.zip
        /// </summary>
        public string VersionsDirName { get; set; } = "";

        /// <summary>
        /// 内置保留 id，删除需特殊确认；默认不可删
        /// </summary>
        public string[] BuiltinIds { get; set; } =
        [
            "learning",
            "x-man",
            "cos",
            "planner",
            "docfilter",
            "maze"
        ];
    }

    public class WebSocketSettings
    {
        public string Path { get; set; }
        public string ServerID { get; set; }
        public int KeepAliveInterval { get; set; }
    }
}
