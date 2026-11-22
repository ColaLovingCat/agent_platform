using Microsoft.Extensions.Caching.Memory;
using StackExchange.Redis;
using System.Text.Json;

namespace CommonService.Core.Utils
{
    /// <summary>
    /// 缓存接口，支持异步操作
    /// </summary>
    public interface ICacheHelper
    {
        Task SetAsync<T>(string key, T value, TimeSpan? expire = null);
        Task<T?> GetAsync<T>(string key);
        Task RemoveAsync(string key);
    }

    /// <summary>
    /// 内存缓存与 Redis 自动切换的封装
    /// </summary>
    public class CacheHelper : ICacheHelper
    {
        private readonly IMemoryCache _memoryCache;
        private readonly StackExchange.Redis.IDatabase? _redisDb;

        public CacheHelper(IMemoryCache memoryCache, IConnectionMultiplexer? redisConnection = null)
        {
            _memoryCache = memoryCache;
            _redisDb = redisConnection?.GetDatabase();
        }

        /// <summary>
        /// 设置缓存
        /// </summary>
        public async Task SetAsync<T>(string key, T value, TimeSpan? expire = null)
        {
            if (_redisDb != null)
            {
                var json = JsonSerializer.Serialize(value);
                await _redisDb.StringSetAsync(key, json, expire);
            }
            else
            {
                _memoryCache.Set(key, value, expire ?? TimeSpan.FromMinutes(30));
            }
        }

        /// <summary>
        /// 获取缓存
        /// </summary>
        public async Task<T?> GetAsync<T>(string key)
        {
            if (_redisDb != null)
            {
                var json = await _redisDb.StringGetAsync(key);
                if (json.IsNullOrEmpty) return default;
                return JsonSerializer.Deserialize<T>(json!);
            }
            else
            {
                return _memoryCache.TryGetValue(key, out T value) ? value : default;
            }
        }

        /// <summary>
        /// 删除缓存
        /// </summary>
        public async Task RemoveAsync(string key)
        {
            if (_redisDb != null)
            {
                await _redisDb.KeyDeleteAsync(key);
            }
            else
            {
                _memoryCache.Remove(key);
            }
        }
    }
}
