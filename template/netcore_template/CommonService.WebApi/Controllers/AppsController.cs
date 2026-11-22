using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel.DataAnnotations;

namespace CommonService.WebApi.Controllers
{
    /// <summary>
    /// 门户静态微应用：wwwroot/_versions（registry + zip）与 wwwroot/apps/{id}/
    /// </summary>
    [ApiController]
    [Route("api/apps")]
    public class AppsController : ControllerBase
    {
        public class PublishForm
        {
            [Required]
            public string Id { get; set; } = string.Empty;

            /// <summary>版本号，对应归档 _versions/{id}/{version}.zip</summary>
            [Required]
            public string Version { get; set; } = string.Empty;

            public string? Name { get; set; }
            public string? Description { get; set; }
            public string? Icon { get; set; }
            public string? Color { get; set; }

            [Required]
            public IFormFile Zip { get; set; } = default!;
        }

        private readonly IPortalAppsService _service;

        public AppsController(IPortalAppsService service)
        {
            _service = service;
        }

        /// <summary>合并内置 + registry 列表（含 currentVersion / versions）</summary>
        [HttpGet("getlist")]
        public async Task<ApiResponse<IReadOnlyList<PortalAppDto>>> GetList()
        {
            var list = await _service.GetListAsync();
            return ApiResponse<IReadOnlyList<PortalAppDto>>.Ok(list);
        }

        /// <summary>仅登记元数据（不写静态文件）</summary>
        [HttpPost("add")]
        public async Task<ApiResponse<string>> Add([FromBody] PortalAppAddDto dto)
        {
            var result = await _service.AddAsync(dto);
            return result == ResultStatus.OK
                ? ApiResponse<string>.Ok(result, "已登记")
                : ApiResponse<string>.Fail(result);
        }

        /// <summary>上传 zip：解压到 DeployRoot/{id}，并归档到 _versions/{id}/{version}.zip</summary>
        [HttpPost("publish")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(104857600)]
        public async Task<ApiResponse<string>> Publish([FromForm] PublishForm form)
        {
            if (form.Zip == null || form.Zip.Length == 0)
                return ApiResponse<string>.Fail("zip 不能为空");
            if (string.IsNullOrWhiteSpace(form.Version))
                return ApiResponse<string>.Fail("version 不能为空");

            await using var stream = form.Zip.OpenReadStream();
            var result = await _service.PublishAsync(
                form.Id,
                form.Version,
                form.Name,
                form.Description,
                form.Icon,
                form.Color,
                stream,
                form.Zip.FileName);

            return result == ResultStatus.OK
                ? ApiResponse<string>.Ok(result, $"发布成功 v{form.Version}")
                : ApiResponse<string>.Fail(result);
        }

        /// <summary>从已归档 zip 回滚到指定 version</summary>
        [HttpPost("rollback")]
        public async Task<ApiResponse<string>> Rollback([FromBody] PortalAppRollbackDto dto)
        {
            var result = await _service.RollbackAsync(dto.Id, dto.Version);
            return result == ResultStatus.OK
                ? ApiResponse<string>.Ok(result, $"已回滚到 v{dto.Version}")
                : ApiResponse<string>.Fail(result);
        }

        /// <summary>从 registry 移除并删除 DeployRoot/{id} 与版本归档（内置需 force）</summary>
        [HttpPost("delete")]
        public async Task<ApiResponse<string>> Delete([FromBody] PortalAppDeleteDto dto)
        {
            var result = await _service.DeleteAsync(dto.Id, dto.Force);
            return result == ResultStatus.OK
                ? ApiResponse<string>.Ok(result, "已删除")
                : ApiResponse<string>.Fail(result);
        }
    }
}
