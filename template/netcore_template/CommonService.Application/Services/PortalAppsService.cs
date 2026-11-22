using System.IO.Compression;
using System.Text.Json;
using System.Text.RegularExpressions;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;

namespace CommonService.Application.Services
{
    public class PortalAppsService : IPortalAppsService
    {
        private static readonly Regex AppIdPattern = new(@"^[a-z0-9][a-z0-9-]{1,31}$", RegexOptions.Compiled);
        private static readonly Regex VersionPattern = new(@"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,31}$", RegexOptions.Compiled);
        private static readonly JsonSerializerOptions JsonOpts = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            WriteIndented = true
        };

        private readonly PortalAppsSettings _settings;
        private readonly string _deployRoot;
        private readonly string _metaRoot;
        private readonly string _registryPath;
        private readonly string _versionsRoot;
        private readonly HashSet<string> _builtinIds;

        private static readonly Dictionary<string, PortalAppDto> BuiltinSeed = new(StringComparer.OrdinalIgnoreCase)
        {
            ["learning"] = new()
            {
                Id = "learning",
                Name = "Learning",
                Description = "企业学习平台（静态 HTML，iframe 嵌入）",
                Icon = "fa-graduation-cap",
                Color = "#143b5c"
            },
            ["x-man"] = new()
            {
                Id = "x-man",
                Name = "X-man",
                Description = "Shopfloor steering board（Vite 静态产物，iframe 嵌入）",
                Icon = "fa-industry",
                Color = "#0f766e"
            },
            ["cos"] = new()
            {
                Id = "cos",
                Name = "COS",
                Description = "COS Documents Coordinator（Vite 静态产物，iframe 嵌入）",
                Icon = "fa-file-lines",
                Color = "#1d4ed8"
            },
            ["planner"] = new()
            {
                Id = "planner",
                Name = "Planner",
                Description = "APS scheduling workspace（Vite 静态产物，iframe 嵌入）",
                Icon = "fa-calendar-days",
                Color = "#7c3aed"
            },
            ["docfilter"] = new()
            {
                Id = "docfilter",
                Name = "DocFilter",
                Description = "文档层级检索与预览（Vite 静态产物，iframe 嵌入）",
                Icon = "fa-filter",
                Color = "#0284c7"
            },
            ["maze"] = new()
            {
                Id = "maze",
                Name = "Maze",
                Description = "PO 交期与 OC 追踪（Vite 静态产物，iframe 嵌入）",
                Icon = "fa-clipboard-list",
                Color = "#4338ca"
            }
        };

        public PortalAppsService(PortalAppsSettings settings, string contentRootPath)
        {
            _settings = settings ?? new PortalAppsSettings();

            _deployRoot = ResolveRoot(
                string.IsNullOrWhiteSpace(_settings.DeployRoot)
                    ? "wwwroot/apps"
                    : _settings.DeployRoot,
                contentRootPath);

            _metaRoot = ResolveRoot(
                string.IsNullOrWhiteSpace(_settings.MetaRoot)
                    ? "wwwroot/_versions"
                    : _settings.MetaRoot,
                contentRootPath);

            var registryName = string.IsNullOrWhiteSpace(_settings.RegistryFileName)
                ? "registry.json"
                : Path.GetFileName(_settings.RegistryFileName);
            _registryPath = Path.Combine(_metaRoot, registryName);

            // VersionsDirName 为空时：zip 直接在 MetaRoot/{id}/{version}.zip（即 wwwroot/_versions/...）
            var versionsDir = string.IsNullOrWhiteSpace(_settings.VersionsDirName)
                ? ""
                : Path.GetFileName(_settings.VersionsDirName.Trim());
            _versionsRoot = string.IsNullOrEmpty(versionsDir) || versionsDir == "."
                ? _metaRoot
                : Path.Combine(_metaRoot, versionsDir);

            _builtinIds = new HashSet<string>(
                _settings.BuiltinIds?.Length > 0 ? _settings.BuiltinIds : BuiltinSeed.Keys,
                StringComparer.OrdinalIgnoreCase);
        }

        private static string ResolveRoot(string configured, string contentRootPath)
        {
            var root = configured.Trim();
            return Path.IsPathRooted(root)
                ? Path.GetFullPath(root)
                : Path.GetFullPath(Path.Combine(contentRootPath, root));
        }

        public async Task<IReadOnlyList<PortalAppDto>> GetListAsync()
        {
            EnsureDeployRoot();
            var registry = await ReadRegistryAsync();
            var map = new Dictionary<string, PortalAppDto>(StringComparer.OrdinalIgnoreCase);

            foreach (var id in _builtinIds)
            {
                if (BuiltinSeed.TryGetValue(id, out var seed))
                    map[id] = Clone(seed, dynamic: false);
                else
                    map[id] = new PortalAppDto { Id = id, Name = id, Dynamic = false };
            }

            foreach (var item in registry)
            {
                if (!IsValidAppId(item.Id)) continue;
                var isBuiltin = _builtinIds.Contains(item.Id);
                map[item.Id] = new PortalAppDto
                {
                    Id = item.Id,
                    Name = string.IsNullOrWhiteSpace(item.Name) ? item.Id : item.Name,
                    Description = item.Description ?? "",
                    Icon = string.IsNullOrWhiteSpace(item.Icon) ? "fa-cube" : item.Icon,
                    Color = string.IsNullOrWhiteSpace(item.Color) ? "#334155" : item.Color,
                    Dynamic = !isBuiltin,
                    CurrentVersion = item.CurrentVersion,
                    Versions = item.Versions?.OrderByDescending(v => v.PublishedAt).ToList() ?? []
                };
            }

            foreach (var kv in map)
            {
                var indexPath = Path.Combine(_deployRoot, kv.Key, "index.html");
                kv.Value.Deployed = File.Exists(indexPath);
                if (kv.Value.Deployed)
                    kv.Value.IndexHtmlModifiedAt = File.GetLastWriteTimeUtc(indexPath);
                if (kv.Value.Versions.Count == 0)
                    kv.Value.Versions = ListArchivedVersionsFromDisk(kv.Key);
                if (string.IsNullOrWhiteSpace(kv.Value.CurrentVersion) && kv.Value.Versions.Count > 0)
                    kv.Value.CurrentVersion = kv.Value.Versions[0].Version;
            }

            return map.Values.OrderBy(a => a.Dynamic).ThenBy(a => a.Id).ToList();
        }

        public async Task<string> AddAsync(PortalAppAddDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Id))
                return "id 不能为空";
            if (!IsValidAppId(dto.Id))
                return "id 格式无效（^[a-z0-9][a-z0-9-]{1,31}$）";

            EnsureDeployRoot();
            var registry = await ReadRegistryAsync();
            var existing = registry.FirstOrDefault(a => a.Id.Equals(dto.Id, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
            {
                registry.Add(new PortalAppDto
                {
                    Id = dto.Id.Trim(),
                    Name = string.IsNullOrWhiteSpace(dto.Name) ? dto.Id.Trim() : dto.Name.Trim(),
                    Description = dto.Description?.Trim() ?? "",
                    Icon = string.IsNullOrWhiteSpace(dto.Icon) ? "fa-cube" : dto.Icon.Trim(),
                    Color = string.IsNullOrWhiteSpace(dto.Color) ? "#334155" : dto.Color.Trim(),
                    Versions = []
                });
            }
            else
            {
                existing.Name = string.IsNullOrWhiteSpace(dto.Name) ? existing.Name : dto.Name.Trim();
                existing.Description = dto.Description?.Trim() ?? existing.Description;
                existing.Icon = string.IsNullOrWhiteSpace(dto.Icon) ? existing.Icon : dto.Icon.Trim();
                existing.Color = string.IsNullOrWhiteSpace(dto.Color) ? existing.Color : dto.Color.Trim();
            }

            await WriteRegistryAsync(registry);
            return ResultStatus.OK;
        }

        public async Task<string> PublishAsync(
            string id,
            string version,
            string? name,
            string? description,
            string? icon,
            string? color,
            Stream zipStream,
            string zipFileName)
        {
            if (string.IsNullOrWhiteSpace(id))
                return "id 不能为空";
            if (!IsValidAppId(id))
                return "id 格式无效（^[a-z0-9][a-z0-9-]{1,31}$）";
            if (string.IsNullOrWhiteSpace(version) || !IsValidVersion(version))
                return "version 格式无效（^[a-zA-Z0-9][a-zA-Z0-9._-]{0,31}$）";
            if (zipStream == null || !zipStream.CanRead)
                return "zip 文件不能为空";
            if (!zipFileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                return "仅支持 .zip 包";

            EnsureDeployRoot();
            version = version.Trim();

            var tempRoot = Path.Combine(Path.GetTempPath(), "portal-apps", Guid.NewGuid().ToString("N"));
            var zipPath = Path.Combine(tempRoot, "upload.zip");
            var extractDir = Path.Combine(tempRoot, "extract");
            Directory.CreateDirectory(extractDir);

            try
            {
                Directory.CreateDirectory(tempRoot);
                await using (var fs = new FileStream(zipPath, FileMode.Create, FileAccess.Write))
                {
                    await zipStream.CopyToAsync(fs);
                }

                var zipInfo = new FileInfo(zipPath);
                if (zipInfo.Length <= 0)
                    return "zip 文件不能为空";
                if (zipInfo.Length > _settings.MaxZipSizeBytes)
                    return $"zip 超过大小限制 {_settings.MaxZipSize}";

                // 归档 version zip（覆盖同版本）
                var archivePath = GetVersionZipPath(id, version);
                Directory.CreateDirectory(Path.GetDirectoryName(archivePath)!);
                File.Copy(zipPath, archivePath, overwrite: true);

                var deployError = DeployZipFile(zipPath, id);
                if (deployError != null)
                    return deployError;

                var relativeZip = GetRelativeVersionZipPath(id, version);
                var registry = await ReadRegistryAsync();
                var entry = registry.FirstOrDefault(a => a.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
                if (entry == null)
                {
                    entry = new PortalAppDto
                    {
                        Id = id,
                        Name = string.IsNullOrWhiteSpace(name) ? id : name.Trim(),
                        Description = description?.Trim() ?? "",
                        Icon = string.IsNullOrWhiteSpace(icon) ? "fa-cube" : icon.Trim(),
                        Color = string.IsNullOrWhiteSpace(color) ? "#334155" : color.Trim(),
                        Versions = []
                    };
                    registry.Add(entry);
                }
                else
                {
                    if (!string.IsNullOrWhiteSpace(name)) entry.Name = name.Trim();
                    if (description != null) entry.Description = description.Trim();
                    if (!string.IsNullOrWhiteSpace(icon)) entry.Icon = icon.Trim();
                    if (!string.IsNullOrWhiteSpace(color)) entry.Color = color.Trim();
                    entry.Versions ??= [];
                }

                entry.Versions.RemoveAll(v => v.Version.Equals(version, StringComparison.OrdinalIgnoreCase));
                entry.Versions.Add(new PortalAppVersionDto
                {
                    Version = version,
                    PublishedAt = DateTime.UtcNow,
                    ZipPath = relativeZip
                });
                entry.CurrentVersion = version;

                await WriteRegistryAsync(registry);
                return ResultStatus.OK;
            }
            catch (InvalidDataException)
            {
                return "无效的 zip 文件";
            }
            catch (Exception ex)
            {
                return $"发布失败: {ex.Message}";
            }
            finally
            {
                TryDeleteDir(tempRoot);
            }
        }

        public async Task<string> RollbackAsync(string id, string version)
        {
            if (string.IsNullOrWhiteSpace(id) || !IsValidAppId(id))
                return "id 无效";
            if (string.IsNullOrWhiteSpace(version) || !IsValidVersion(version))
                return "version 无效";

            EnsureDeployRoot();
            version = version.Trim();

            var archivePath = GetVersionZipPath(id, version);
            if (!File.Exists(archivePath))
                return $"未找到版本归档: {version}";

            var deployError = DeployZipFile(archivePath, id);
            if (deployError != null)
                return deployError;

            var registry = await ReadRegistryAsync();
            var entry = registry.FirstOrDefault(a => a.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
            if (entry == null)
            {
                entry = new PortalAppDto
                {
                    Id = id,
                    Name = id,
                    Versions = ListArchivedVersionsFromDisk(id)
                };
                registry.Add(entry);
            }

            entry.CurrentVersion = version;
            if (entry.Versions.All(v => !v.Version.Equals(version, StringComparison.OrdinalIgnoreCase)))
            {
                entry.Versions.Add(new PortalAppVersionDto
                {
                    Version = version,
                    PublishedAt = DateTime.UtcNow,
                    ZipPath = GetRelativeVersionZipPath(id, version)
                });
            }

            await WriteRegistryAsync(registry);
            return ResultStatus.OK;
        }

        public async Task<string> DeleteAsync(string id, bool force)
        {
            if (string.IsNullOrWhiteSpace(id))
                return "id 不能为空";
            if (!IsValidAppId(id))
                return "id 格式无效";

            if (_builtinIds.Contains(id) && !force)
                return "内置应用不可删除（如需强制请传 force=true）";

            EnsureDeployRoot();

            var registry = await ReadRegistryAsync();
            registry.RemoveAll(a => a.Id.Equals(id, StringComparison.OrdinalIgnoreCase));
            await WriteRegistryAsync(registry);

            var targetDir = Path.Combine(_deployRoot, id);
            if (IsSafeUnderDeployRoot(targetDir) && Directory.Exists(targetDir))
                Directory.Delete(targetDir, recursive: true);

            var versionDir = Path.Combine(_versionsRoot, id);
            if (IsSafeUnderMetaRoot(versionDir) && Directory.Exists(versionDir))
                Directory.Delete(versionDir, recursive: true);

            return ResultStatus.OK;
        }

        private string? DeployZipFile(string zipPath, string id)
        {
            var tempExtract = Path.Combine(Path.GetTempPath(), "portal-apps-extract", Guid.NewGuid().ToString("N"));
            try
            {
                Directory.CreateDirectory(tempExtract);
                ZipFile.ExtractToDirectory(zipPath, tempExtract, overwriteFiles: true);

                var contentRoot = ResolvePackageRoot(tempExtract);
                if (contentRoot == null)
                    return "zip 内未找到 index.html（需在根目录或单层子目录）";

                var targetDir = Path.Combine(_deployRoot, id);
                if (!IsSafeUnderDeployRoot(targetDir))
                    return "非法目标路径";

                // Windows + UseStaticFiles：正在访问的 index.html 会被占用，
                // Directory.Delete 整目录会失败。改为就地覆盖，再尽量清理旧文件。
                Directory.CreateDirectory(targetDir);
                ClearReadOnlyRecursive(targetDir);
                CopyDirectory(contentRoot, targetDir);
                TryPruneOrphans(contentRoot, targetDir);

                if (!File.Exists(Path.Combine(targetDir, "index.html")))
                    return "部署后缺少 index.html";

                return null;
            }
            catch (UnauthorizedAccessException)
            {
                return "目标文件被占用（常见于正在打开该应用的页面锁定了 index.html），请关闭相关标签页后重试";
            }
            catch (IOException ex) when (ex.Message.Contains("denied", StringComparison.OrdinalIgnoreCase)
                                         || ex.Message.Contains("being used", StringComparison.OrdinalIgnoreCase))
            {
                return "目标文件被占用（常见于正在打开该应用的页面锁定了 index.html），请关闭相关标签页后重试";
            }
            finally
            {
                TryDeleteDir(tempExtract);
            }
        }

        private string GetVersionZipPath(string id, string version) =>
            Path.Combine(_versionsRoot, id, $"{version}.zip");

        private string GetRelativeVersionZipPath(string id, string version)
        {
            var versionsDir = Path.GetFileName(_versionsRoot);
            if (string.IsNullOrEmpty(versionsDir))
                return $"{id}/{version}.zip".Replace('\\', '/');
            return $"{versionsDir}/{id}/{version}.zip".Replace('\\', '/');
        }

        private List<PortalAppVersionDto> ListArchivedVersionsFromDisk(string id)
        {
            var dir = Path.Combine(_versionsRoot, id);
            if (!Directory.Exists(dir))
                return [];

            return Directory.GetFiles(dir, "*.zip")
                .Select(f =>
                {
                    var ver = Path.GetFileNameWithoutExtension(f);
                    var info = new FileInfo(f);
                    return new PortalAppVersionDto
                    {
                        Version = ver,
                        PublishedAt = info.LastWriteTimeUtc,
                        ZipPath = GetRelativeVersionZipPath(id, ver)
                    };
                })
                .Where(v => IsValidVersion(v.Version))
                .OrderByDescending(v => v.PublishedAt)
                .ToList();
        }

        private void EnsureDeployRoot()
        {
            Directory.CreateDirectory(_deployRoot);
            Directory.CreateDirectory(_metaRoot);
            Directory.CreateDirectory(_versionsRoot);
            MigrateLegacyMetaIfNeeded();
            if (!File.Exists(_registryPath))
            {
                File.WriteAllText(_registryPath, """{"apps":[]}""");
            }
        }

        /// <summary>
        /// 若 MetaRoot 尚无 registry，从旧路径 DeployRoot/registry.json 与 DeployRoot/_versions 迁入。
        /// </summary>
        private void MigrateLegacyMetaIfNeeded()
        {
            if (File.Exists(_registryPath))
                return;

            var legacyRegistry = Path.Combine(_deployRoot, Path.GetFileName(_registryPath));
            if (File.Exists(legacyRegistry) && !string.Equals(
                    Path.GetFullPath(legacyRegistry),
                    Path.GetFullPath(_registryPath),
                    StringComparison.OrdinalIgnoreCase))
            {
                File.Copy(legacyRegistry, _registryPath, overwrite: false);
            }

            // 旧布局：DeployRoot/_versions/{id}/*.zip
            var legacyVersionsNested = Path.Combine(_deployRoot, "_versions");
            if (Directory.Exists(legacyVersionsNested)
                && !string.Equals(
                    Path.GetFullPath(legacyVersionsNested),
                    Path.GetFullPath(_versionsRoot),
                    StringComparison.OrdinalIgnoreCase))
            {
                CopyDirectory(legacyVersionsNested, _versionsRoot);
            }
        }

        private async Task<List<PortalAppDto>> ReadRegistryAsync()
        {
            if (!File.Exists(_registryPath))
                return [];

            await using var stream = File.OpenRead(_registryPath);
            var doc = await JsonSerializer.DeserializeAsync<RegistryFile>(stream, JsonOpts);
            return doc?.Apps?
                .Where(a => a != null && !string.IsNullOrWhiteSpace(a.Id))
                .Select(a => new PortalAppDto
                {
                    Id = a!.Id.Trim(),
                    Name = a.Name ?? a.Id,
                    Description = a.Description ?? "",
                    Icon = a.Icon ?? "fa-cube",
                    Color = a.Color ?? "#334155",
                    CurrentVersion = a.CurrentVersion,
                    Versions = a.Versions ?? []
                })
                .ToList() ?? [];
        }

        private async Task WriteRegistryAsync(List<PortalAppDto> apps)
        {
            var payload = new RegistryFile
            {
                Apps = apps.Select(a => new PortalAppDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    Description = a.Description,
                    Icon = a.Icon,
                    Color = a.Color,
                    CurrentVersion = a.CurrentVersion,
                    Versions = a.Versions ?? []
                }).ToList()
            };
            await using var stream = File.Create(_registryPath);
            await JsonSerializer.SerializeAsync(stream, payload, JsonOpts);
        }

        private bool IsSafeUnderDeployRoot(string path) => IsSafeUnderRoot(path, _deployRoot);

        private bool IsSafeUnderMetaRoot(string path) => IsSafeUnderRoot(path, _metaRoot);

        private static bool IsSafeUnderRoot(string path, string rootDir)
        {
            var full = Path.GetFullPath(path)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            var root = Path.GetFullPath(rootDir)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
            return string.Equals(full, root, StringComparison.OrdinalIgnoreCase)
                   || full.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsValidAppId(string id) => AppIdPattern.IsMatch(id);
        private static bool IsValidVersion(string version) => VersionPattern.IsMatch(version);

        private static PortalAppDto Clone(PortalAppDto src, bool dynamic) => new()
        {
            Id = src.Id,
            Name = src.Name,
            Description = src.Description,
            Icon = src.Icon,
            Color = src.Color,
            Dynamic = dynamic,
            CurrentVersion = src.CurrentVersion,
            Versions = src.Versions?.ToList() ?? []
        };

        private static string? ResolvePackageRoot(string extractDir)
        {
            if (File.Exists(Path.Combine(extractDir, "index.html")))
                return extractDir;

            var dirs = Directory.GetDirectories(extractDir);
            if (dirs.Length == 1 && File.Exists(Path.Combine(dirs[0], "index.html")))
                return dirs[0];

            foreach (var dir in dirs)
            {
                if (File.Exists(Path.Combine(dir, "index.html")))
                    return dir;
            }

            return null;
        }

        private static void CopyDirectory(string sourceDir, string targetDir)
        {
            foreach (var dir in Directory.GetDirectories(sourceDir, "*", SearchOption.AllDirectories))
            {
                var rel = Path.GetRelativePath(sourceDir, dir);
                if (rel.Contains("..", StringComparison.Ordinal))
                    throw new InvalidOperationException("zip 内含非法路径");
                Directory.CreateDirectory(Path.Combine(targetDir, rel));
            }

            foreach (var file in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
            {
                var rel = Path.GetRelativePath(sourceDir, file);
                if (rel.Contains("..", StringComparison.Ordinal))
                    throw new InvalidOperationException("zip 内含非法路径");
                var dest = Path.Combine(targetDir, rel);
                Directory.CreateDirectory(Path.GetDirectoryName(dest)!);
                CopyFileOverwrite(file, dest);
            }
        }

        /// <summary>
        /// 覆盖写入；若目标被短暂占用，先写同目录临时文件再 Replace。
        /// </summary>
        private static void CopyFileOverwrite(string source, string dest)
        {
            if (File.Exists(dest))
            {
                try
                {
                    var attrs = File.GetAttributes(dest);
                    if ((attrs & FileAttributes.ReadOnly) != 0)
                        File.SetAttributes(dest, attrs & ~FileAttributes.ReadOnly);
                }
                catch
                {
                    /* ignore */
                }
            }

            try
            {
                File.Copy(source, dest, overwrite: true);
                return;
            }
            catch (IOException)
            {
                /* fall through */
            }
            catch (UnauthorizedAccessException)
            {
                /* fall through */
            }

            var temp = dest + $".__new-{Guid.NewGuid():N}";
            try
            {
                File.Copy(source, temp, overwrite: true);
                File.Replace(temp, dest, destinationBackupFileName: null);
            }
            finally
            {
                try
                {
                    if (File.Exists(temp))
                        File.Delete(temp);
                }
                catch
                {
                    /* ignore */
                }
            }
        }

        /// <summary>删除目标目录中不在本次包内的旧文件（删除失败则忽略，避免占用导致整次发布失败）。</summary>
        private static void TryPruneOrphans(string sourceDir, string targetDir)
        {
            var keep = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var file in Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories))
            {
                var rel = Path.GetRelativePath(sourceDir, file);
                if (!rel.Contains("..", StringComparison.Ordinal))
                    keep.Add(rel);
            }

            foreach (var file in Directory.GetFiles(targetDir, "*", SearchOption.AllDirectories))
            {
                var rel = Path.GetRelativePath(targetDir, file);
                if (keep.Contains(rel))
                    continue;
                try
                {
                    ClearReadOnly(file);
                    File.Delete(file);
                }
                catch
                {
                    /* ignore locked leftovers */
                }
            }
        }

        private static void ClearReadOnlyRecursive(string dir)
        {
            if (!Directory.Exists(dir))
                return;
            foreach (var file in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
                ClearReadOnly(file);
        }

        private static void ClearReadOnly(string path)
        {
            try
            {
                if (!File.Exists(path))
                    return;
                var attrs = File.GetAttributes(path);
                if ((attrs & FileAttributes.ReadOnly) != 0)
                    File.SetAttributes(path, attrs & ~FileAttributes.ReadOnly);
            }
            catch
            {
                /* ignore */
            }
        }

        private static void TryDeleteDir(string path)
        {
            try
            {
                if (Directory.Exists(path))
                    Directory.Delete(path, recursive: true);
            }
            catch
            {
                /* ignore */
            }
        }

        private sealed class RegistryFile
        {
            public List<PortalAppDto>? Apps { get; set; }
        }
    }
}
