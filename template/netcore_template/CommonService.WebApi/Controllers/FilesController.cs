using CommonService.Core.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.Options;
using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Sockets;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api")]
    public class FilesController : ControllerBase
    {
        public class FileUploadModel
        {
            [Required]
            public IFormFile File { get; set; }
        }

        public class FileUploadMultiModel
        {
            [Required]
            public List<IFormFile> Files { get; set; }
        }

        public class FileInfoDto
        {
            public string Name { get; set; }
            public string OriginalName { get; set; }
            public string Url { get; set; }

            public string Type { get; set; }
            public long Size { get; set; }

            public DateTime? CreatedTime { get; set; }
            public DateTime? ModificationTime { get; set; }
            public bool? IsDirectory { get; set; } = false;
        }

        public class FileChunkModel
        {
            public string Filename { get; set; } = default!;
            public IFormFile File { get; set; } = default!;
            public string Hash { get; set; } = default!;
            public int ChunkIndex { get; set; }
            public int TotalChunks { get; set; }
        }
        public class FileMergeDto
        {
            public string Filename { get; set; } = default!;
            public string? Hash { get; set; } = default!;
            public int? TotalChunks { get; set; } = default!;
        }
        public class FileDeleteDto
        {
            public string Filename { get; set; } = default!;
        }

        public class FetchErrorDto
        {
            public string error { get; set; } = default!;
        }

        private readonly string _uploadFolder;
        private readonly IOptions<AppSettings> _settings;
        private readonly IOptions<UploadSettings> _uploadSettings;
        private readonly IHttpClientFactory _httpClientFactory;
        private static readonly FileExtensionContentTypeProvider ContentTypeProvider = new();

        public FilesController(
            IOptions<UploadSettings> uploadSettings,
            IOptions<AppSettings> settings,
            IHttpClientFactory httpClientFactory)
        {
            _uploadSettings = uploadSettings;
            _uploadFolder = Path.Combine(Directory.GetCurrentDirectory(), _uploadSettings.Value.Path);
            if (!Directory.Exists(_uploadFolder)) Directory.CreateDirectory(_uploadFolder);
            _settings = settings;
            _httpClientFactory = httpClientFactory;
        }

        /// <summary>
        /// 单文件上传，单文件默认限制 10MB
        /// </summary>
        /// <param name="model">上传的文件</param>
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<ApiResponse<FileInfoDto>> Upload([FromForm] FileUploadModel model)
        {
            if (model.File == null || model.File.Length == 0)
                return ApiResponse<FileInfoDto>.Fail("文件不能为空");

            var maxSize = _uploadSettings.Value.MaxFileSizeBytes;
            if (model.File.Length > maxSize)
            {
                return ApiResponse<FileInfoDto>.Fail($"File size exceeds limit of {maxSize} bytes.");
            }

            // 防止目录穿透攻击，提取纯文件名
            var originalName = Path.GetFileName(model.File.FileName);
            var safeFileName = $"{Guid.NewGuid()}_{originalName}";

            var savePath = Path.Combine(_uploadFolder, safeFileName);

            // 确保目录存在
            Directory.CreateDirectory(_uploadFolder);

            using var stream = new FileStream(savePath, FileMode.Create);
            await model.File.CopyToAsync(stream);

            // 构建访问路径（假设你已开启静态文件映射）
            var requestInfos = GetInfosRequest();
            var fileUrl = $"{requestInfos.scheme}://{requestInfos.host}/uploads/{safeFileName}";

            return ApiResponse<FileInfoDto>.Ok(new FileInfoDto
            {
                Name = safeFileName,
                OriginalName = originalName,
                Type = model.File.ContentType,
                Size = model.File.Length,
                Url = fileUrl
            });
        }

        /// <summary>
        /// 多文件上传
        /// </summary>
        /// <param name="model">上传的文件列表</param>
        [HttpPost("upload/multi")]
        [Consumes("multipart/form-data")]
        public async Task<ApiResponse<List<FileInfoDto>>> UploadMultiple([FromForm] FileUploadMultiModel model)
        {
            if (model.Files == null || model.Files.Count == 0)
                return ApiResponse<List<FileInfoDto>>.Fail("至少上传一个文件");

            Directory.CreateDirectory(_uploadFolder);

            var results = new List<FileInfoDto>();

            foreach (var file in model.Files)
            {
                if (file == null || file.Length == 0)
                    continue; // 跳过空文件

                var originalName = Path.GetFileName(file.FileName);
                var safeFileName = $"{Guid.NewGuid()}_{originalName}";
                var savePath = Path.Combine(_uploadFolder, safeFileName);

                using var stream = new FileStream(savePath, FileMode.Create);
                await file.CopyToAsync(stream);

                var requestInfos = GetInfosRequest();
                var fileUrl = $"{requestInfos.scheme}://{requestInfos.host}/uploads/{safeFileName}";

                results.Add(new FileInfoDto
                {
                    Name = safeFileName,
                    OriginalName = originalName,
                    Type = file.ContentType,
                    Size = file.Length,
                    Url = fileUrl
                });
            }

            if (results.Count == 0)
                return ApiResponse<List<FileInfoDto>>.Fail("上传的文件无效");

            return ApiResponse<List<FileInfoDto>>.Ok(results);
        }


        /// <summary>
        /// 上传单个分片
        /// </summary>
        [HttpPost("upload/chunk")]
        [Consumes("multipart/form-data")]
        public async Task<ApiResponse<string>> UploadChunk([FromForm] FileChunkModel model)
        {
            if (model.File == null || model.File.Length == 0)
                return ApiResponse<string>.Fail("分片不能为空");

            var chunkDir = Path.Combine(_uploadFolder, "chunks", model.Hash);
            Directory.CreateDirectory(chunkDir);

            var chunkPath = Path.Combine(chunkDir, $"{model.ChunkIndex:D5}.part");

            using var stream = new FileStream(chunkPath, FileMode.Create);
            await model.File.CopyToAsync(stream);

            return ApiResponse<string>.Ok("分片上传成功");
        }

        /// <summary>
        /// 合并分片
        /// </summary>
        [HttpPost("upload/merge")]
        public async Task<ApiResponse<FileInfoDto>> MergeChunks([FromBody] FileMergeDto request)
        {
            var chunkDir = Path.Combine(_uploadFolder, "chunks", request.Hash);
            if (!Directory.Exists(chunkDir))
                return ApiResponse<FileInfoDto>.Fail("找不到分片目录");

            var files = Directory.GetFiles(chunkDir).OrderBy(f => f).ToList();
            if (!files.Any())
                return ApiResponse<FileInfoDto>.Fail("没有分片");

            var safeFileName = $"{Guid.NewGuid()}_{Path.GetFileName(request.Filename)}";
            var mergedPath = Path.Combine(_uploadFolder, safeFileName);

            await using var output = new FileStream(mergedPath, FileMode.Create);
            foreach (var file in files)
            {
                await using var partStream = new FileStream(file, FileMode.Open);
                await partStream.CopyToAsync(output);
            }

            Directory.Delete(chunkDir, true); // 清理临时分片

            var requestInfos = GetInfosRequest();
            var url = $"{requestInfos.scheme}://{requestInfos.host}/uploads/{safeFileName}";
            var fileInfo = new FileInfo(mergedPath);

            return ApiResponse<FileInfoDto>.Ok(new FileInfoDto
            {
                Name = safeFileName,
                OriginalName = request.Filename,
                Type = GetFileExtension(safeFileName),
                Size = fileInfo.Length,
                Url = url
            });
        }

        /// <summary>
        /// 获取上传目录文件列表
        /// </summary>
        [HttpGet("files/getlist")]
        public ApiResponse<List<FileInfoDto>> GetFileList()
        {
            var list = new List<FileInfoDto>();

            if (!Directory.Exists(_uploadFolder))
                return ApiResponse<List<FileInfoDto>>.Ok(list); // 空列表

            var files = new DirectoryInfo(_uploadFolder).GetFileSystemInfos();

            foreach (var fileInfo in files)
            {
                var isDir = (fileInfo.Attributes & FileAttributes.Directory) == FileAttributes.Directory;
                var name = fileInfo.Name;
                var ext = isDir ? "" : Path.GetExtension(name);

                var requestInfos = GetInfosRequest();
                var dto = new FileInfoDto
                {
                    Name = name,
                    Type = ext,
                    Size = isDir ? 0 : (fileInfo as FileInfo)?.Length ?? 0,
                    CreatedTime = fileInfo.CreationTimeUtc,
                    ModificationTime = fileInfo.LastWriteTimeUtc,
                    Url = isDir ? null : $"{requestInfos.scheme}://{requestInfos.host}/uploads/{Uri.EscapeDataString(name)}",
                    IsDirectory = isDir
                };
                list.Add(dto);
            }

            return ApiResponse<List<FileInfoDto>>.Ok(list);
        }

        /// <summary>
        /// 代理抓取文件内容，供前端预览/下载绕过浏览器跨域限制。
        /// 规则：
        /// 1. url 指向本服务 /uploads/* → 直接从磁盘读取并返回文件流
        /// 2. url 指向外部地址 → 服务端 HTTP 代理抓取后返回文件流
        /// 3. download=false（默认）→ inline，供前端预览（fetch blob + 文件名）
        /// 4. download=true → attachment，触发浏览器下载而非打开
        /// </summary>
        [HttpGet("files/fetch")]
        [Produces("application/octet-stream", "application/json")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(FetchErrorDto), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(FetchErrorDto), StatusCodes.Status404NotFound)]
        [ProducesResponseType(typeof(FetchErrorDto), StatusCodes.Status502BadGateway)]
        [ProducesResponseType(typeof(FetchErrorDto), StatusCodes.Status504GatewayTimeout)]
        public async Task<IActionResult> FetchFile([FromQuery] string url, [FromQuery] bool download = false)
        {
            if (string.IsNullOrWhiteSpace(url))
                return BadRequest(new FetchErrorDto { error = "url is required" });

            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
                return BadRequest(new FetchErrorDto { error = "invalid url" });

            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                return BadRequest(new FetchErrorDto { error = "only http/https is allowed" });

            // Local /uploads/* is served from disk — must run before SSRF host checks (localhost is blocked there).
            var localPath = TryResolveLocalUploadPath(uri);
            if (localPath != null)
            {
                if (!System.IO.File.Exists(localPath))
                    return NotFound(new FetchErrorDto { error = "file not found" });

                var localInfo = new FileInfo(localPath);
                if (localInfo.Length > _uploadSettings.Value.MaxFileSizeBytes)
                    return BadRequest(new FetchErrorDto { error = "file size exceeds limit" });

                var localStream = new FileStream(localPath, FileMode.Open, FileAccess.Read, FileShare.Read);
                if (download)
                    return File(localStream, GetContentType(localPath), localInfo.Name);

                return File(localStream, GetContentType(localPath));
            }

            if (IsBlockedHost(uri))
                return BadRequest(new FetchErrorDto { error = "target host is not allowed" });

            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromMinutes(2);

                using var response = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
                if (!response.IsSuccessStatusCode)
                    return StatusCode((int)response.StatusCode, new FetchErrorDto { error = $"upstream HTTP {(int)response.StatusCode}" });

                var bytes = await response.Content.ReadAsByteArrayAsync();
                if (bytes.Length > _uploadSettings.Value.MaxFileSizeBytes)
                    return BadRequest(new FetchErrorDto { error = "file size exceeds limit" });

                var contentType = response.Content.Headers.ContentType?.MediaType
                    ?? GetContentType(uri.AbsolutePath);
                var fileName = GetFileNameFromResponse(uri, response);

                if (download)
                    return File(bytes, contentType, fileName);

                return File(bytes, contentType);
            }
            catch (TaskCanceledException)
            {
                return StatusCode(StatusCodes.Status504GatewayTimeout, new FetchErrorDto { error = "fetch timeout" });
            }
            catch (HttpRequestException ex)
            {
                return StatusCode(StatusCodes.Status502BadGateway, new FetchErrorDto { error = ex.Message });
            }
        }

        /// <summary>
        /// 删除文件
        /// </summary>
        [HttpPost("files/delete")]
        public ApiResponse<string> DeleteFile([FromBody] FileDeleteDto file)
        {
            var filePath = Path.Combine(_uploadFolder, file.Filename);
            if (!System.IO.File.Exists(filePath))
                return ApiResponse<string>.Fail("文件不存在");

            System.IO.File.Delete(filePath);
            return ApiResponse<string>.Ok("文件已删除");
        }

        private string GetFileExtension(string fileName)
        {
            return Path.GetExtension(fileName)?.ToLower() ?? "";
        }

        private string? TryResolveLocalUploadPath(Uri uri)
        {
            var segments = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length != 2 || !segments[0].Equals("uploads", StringComparison.OrdinalIgnoreCase))
                return null;

            var isLoopbackHost = uri.IsLoopback
                || string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase);

            if (!isLoopbackHost)
            {
                var requestInfos = GetInfosRequest();
                var appUri = new Uri($"{requestInfos.scheme}://{requestInfos.host}");
                if (!HostEquals(uri, appUri))
                    return null;
            }

            var fileName = Path.GetFileName(Uri.UnescapeDataString(segments[1]));
            if (string.IsNullOrWhiteSpace(fileName) || fileName.Contains("..", StringComparison.Ordinal))
                return null;

            var fullPath = Path.GetFullPath(Path.Combine(_uploadFolder, fileName));
            if (!fullPath.StartsWith(Path.GetFullPath(_uploadFolder), StringComparison.OrdinalIgnoreCase))
                return null;

            return fullPath;
        }

        private static bool HostEquals(Uri left, Uri right)
        {
            return string.Equals(left.Host, right.Host, StringComparison.OrdinalIgnoreCase)
                && left.Port == right.Port;
        }

        private static bool IsBlockedHost(Uri uri)
        {
            if (uri.IsLoopback)
                return true;

            if (string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase))
                return true;

            if (IPAddress.TryParse(uri.Host, out var ip))
                return IsPrivateOrReservedIp(ip);

            try
            {
                var addresses = Dns.GetHostAddresses(uri.Host);
                return addresses.Any(IsPrivateOrReservedIp);
            }
            catch
            {
                return true;
            }
        }

        private static bool IsPrivateOrReservedIp(IPAddress ip)
        {
            if (IPAddress.IsLoopback(ip))
                return true;

            if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            {
                if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal)
                    return true;

                var bytes = ip.GetAddressBytes();
                if (bytes.Length >= 2 && bytes[0] == 0xFC)
                    return true;
                if (bytes.Length >= 2 && bytes[0] == 0xFD)
                    return true;
            }

            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                var bytes = ip.GetAddressBytes();
                if (bytes[0] == 10)
                    return true;
                if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
                    return true;
                if (bytes[0] == 192 && bytes[1] == 168)
                    return true;
                if (bytes[0] == 169 && bytes[1] == 254)
                    return true;
                if (bytes[0] == 127)
                    return true;
            }

            return false;
        }

        private static string GetContentType(string path)
        {
            return ContentTypeProvider.TryGetContentType(path, out var contentType)
                ? contentType
                : "application/octet-stream";
        }

        private static string GetFileNameFromResponse(Uri uri, HttpResponseMessage response)
        {
            var disposition = response.Content.Headers.ContentDisposition;
            if (!string.IsNullOrWhiteSpace(disposition?.FileNameStar))
                return disposition.FileNameStar.Trim('"');

            if (!string.IsNullOrWhiteSpace(disposition?.FileName))
                return disposition.FileName.Trim('"');

            var name = Path.GetFileName(Uri.UnescapeDataString(uri.AbsolutePath));
            return string.IsNullOrWhiteSpace(name) ? "download" : name;
        }

        public class RequestDto
        {
            public string scheme { get; set; }
            public string host { get; set; }
        }
        private RequestDto GetInfosRequest()
        {
            return new RequestDto { scheme = _settings.Value.Protocol, host = $"{_settings.Value.Hostname}:{_settings.Value.Port}" };
        }
    }
}
