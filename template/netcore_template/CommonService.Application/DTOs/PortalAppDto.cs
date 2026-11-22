namespace CommonService.Application.DTOs
{
    public class PortalAppVersionDto
    {
        public string Version { get; set; } = string.Empty;
        public DateTime PublishedAt { get; set; }
        /// <summary>相对路径，如 _versions/{id}/{version}.zip</summary>
        public string ZipPath { get; set; } = string.Empty;
    }

    public class PortalAppDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = "fa-cube";
        public string Color { get; set; } = "#334155";
        /// <summary>非内置、来自 registry 的动态项</summary>
        public bool Dynamic { get; set; }
        /// <summary>DeployRoot/{id}/index.html 是否存在</summary>
        public bool Deployed { get; set; }
        /// <summary>DeployRoot/{id}/index.html 最后修改时间（UTC），用于前端 cache-bust</summary>
        public DateTime? IndexHtmlModifiedAt { get; set; }
        /// <summary>当前线上版本</summary>
        public string? CurrentVersion { get; set; }
        /// <summary>已归档可回滚版本</summary>
        public List<PortalAppVersionDto> Versions { get; set; } = [];
    }

    public class PortalAppAddDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Icon { get; set; } = "fa-cube";
        public string Color { get; set; } = "#334155";
    }

    public class PortalAppDeleteDto
    {
        public string Id { get; set; } = string.Empty;
        /// <summary>删除内置 id 时需为 true</summary>
        public bool Force { get; set; }
    }

    public class PortalAppRollbackDto
    {
        public string Id { get; set; } = string.Empty;
        public string Version { get; set; } = string.Empty;
    }
}
