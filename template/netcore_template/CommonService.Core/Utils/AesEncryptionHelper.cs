using System.Security.Cryptography;
using Microsoft.Extensions.Configuration;

namespace CommonService.Core.Utils
{
    public static class AesEncryptionHelper
    {
        private static readonly byte[] Key = new byte[] { 0x8F, 0xA2, 0x53, 0x9C, 0x12, 0x7D, 0x4B, 0xE1, 0x5F, 0xC9, 0x77, 0xAA, 0x3D, 0xF8, 0x6E, 0x10, 0x2B, 0xD4, 0x9E, 0x60, 0x8C, 0xA3, 0x45, 0xF1, 0x1D, 0x7A, 0x6F, 0xE8, 0x34, 0xB2, 0x9C, 0x50 }; // 16字节 = 128位
        private static readonly byte[] IV = new byte[] { 0x31, 0x7B, 0xC4, 0x19, 0xF5, 0xD3, 0x6A, 0x28, 0x8E, 0x4F, 0xB1, 0x7C, 0x02, 0xD9, 0x53, 0xA0 };  // 16字节

        public static string Encrypt(string plainText)
        {
            using var aes = Aes.Create();
            aes.Key = Key;
            aes.IV = IV;

            var encryptor = aes.CreateEncryptor(aes.Key, aes.IV);
            using var ms = new MemoryStream();
            using (var cs = new CryptoStream(ms, encryptor, CryptoStreamMode.Write))
            using (var sw = new StreamWriter(cs))
            {
                sw.Write(plainText);
            }
            return Convert.ToBase64String(ms.ToArray());
        }

        public static string Decrypt(string cipherText)
        {
            var buffer = Convert.FromBase64String(cipherText);
            using var aes = Aes.Create();
            aes.Key = Key;
            aes.IV = IV;

            var decryptor = aes.CreateDecryptor(aes.Key, aes.IV);
            using var ms = new MemoryStream(buffer);
            using var cs = new CryptoStream(ms, decryptor, CryptoStreamMode.Read);
            using var sr = new StreamReader(cs);
            return sr.ReadToEnd();
        }

        public static string HashPassword(string password)
        {
            return BCrypt.Net.BCrypt.HashPassword(password);
        }

        public static bool VerifyPassword(string password, string hashPassword)
        {
            return BCrypt.Net.BCrypt.Verify(password, hashPassword);
        }
    }

    public static class ConStrHelper
    {
        /// <summary>
        /// 解析并解密 Oracle 连接字符串中形如 Password=AES(...) 的字段
        /// </summary>
        /// <param name="configuration">IConfiguration</param>
        /// <param name="name">连接字符串名称</param>
        /// <returns>已解密的连接字符串</returns>
        public static string GetDecryptedConnectionString(IConfiguration configuration, string name)
        {
            var connStr = configuration.GetConnectionString(name);
            var passwordEncryptedPrefix = "Password=AES(";

            if (!string.IsNullOrWhiteSpace(connStr) && connStr.Contains(passwordEncryptedPrefix))
            {
                int start = connStr.IndexOf(passwordEncryptedPrefix) + passwordEncryptedPrefix.Length;
                int end = connStr.IndexOf(");", start);
                if (end == -1) end = connStr.Length;

                var encryptedPwd = connStr.Substring(start, end - start);
                // 这里调用你自己的 AES 解密工具
                string decryptedPwd = AesEncryptionHelper.Decrypt(encryptedPwd);

                connStr = connStr.Replace($"{passwordEncryptedPrefix}{encryptedPwd})", $"Password={decryptedPwd}");
            }

            return connStr;
        }
    }
}
