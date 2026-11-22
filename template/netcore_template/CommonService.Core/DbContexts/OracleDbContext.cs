using CommonService.Core.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace CommonService.Core.DbContexts
{
    public class OracleDbContext : DbContext
    {
        public OracleDbContext(DbContextOptions<OracleDbContext> options)
            : base(options)
        {
        }

        public DbSet<UserInfo> UserInfos => Set<UserInfo>();
        public DbSet<UserRole> UserRoles => Set<UserRole>();
        public DbSet<UserLinks> UserLinks => Set<UserLinks>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<UserInfo>().ToTable("SYSTEM_USERINFOS");
            modelBuilder.Entity<UserRole>().ToTable("SYSTEM_USERROLES");

            modelBuilder.Entity<UserLinks>(entity =>
            {
                entity.HasKey(e => new { e.UserID, e.RoleID });
                entity.HasOne(e => e.UserInfo)
                      .WithMany(u => u.Roles)
                      .HasForeignKey(e => e.UserID);
                entity.HasOne(e => e.UserRole)
                      .WithMany(r => r.Users)
                      .HasForeignKey(e => e.RoleID);
                entity.ToTable("SYSTEM_USERLINKS");
            });

            // Guid 转换器：将 Guid 存储为 36 字符的字符串（小写，与数据库现有数据保持一致）
            var guidConverter = new ValueConverter<Guid, string>(
                v => v.ToString().ToLower(),
                v => Guid.Parse(v));

            var nullableGuidConverter = new ValueConverter<Guid?, string?>(
                v => v.HasValue ? v.Value.ToString().ToLower() : null,
                v => string.IsNullOrEmpty(v) ? null : Guid.Parse(v));

            base.OnModelCreating(modelBuilder);
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entity.GetProperties())
                {
                    // 列名统一大写
                    property.SetColumnName(property.Name.ToUpper());

                    // 配置 Guid 类型使用 VARCHAR2(36) 存储
                    if (property.ClrType == typeof(Guid))
                    {
                        property.SetColumnType("VARCHAR2(36)");
                        property.SetValueConverter(guidConverter);
                    }
                    else if (property.ClrType == typeof(Guid?))
                    {
                        property.SetColumnType("VARCHAR2(36)");
                        property.SetValueConverter(nullableGuidConverter);
                    }
                }
            }
        }
    }
}
