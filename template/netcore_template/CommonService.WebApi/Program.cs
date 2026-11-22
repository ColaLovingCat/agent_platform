using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using CommonService.Core.DbContexts;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using CommonService.Core.Repositories;
using CommonService.Core.Utils;
using CommonService.Application.Mappings;
using CommonService.Application.Services.Interfaces;
using CommonService.Application.Services;
using CommonService.WebApi.Middlewares;
using WebSocketMiddleware = CommonService.WebApi.Middlewares.WebSocketMiddleware;
using StackExchange.Redis;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

#region ==================== ???��??? ====================

// ???? 
builder.Services.Configure<AppSettings>(builder.Configuration.GetSection("AppSettings"));
builder.Services.Configure<AzureSettings>(builder.Configuration.GetSection("AzureSettings"));
builder.Services.Configure<iUserSettings>(builder.Configuration.GetSection("iUserSettings"));
builder.Services.Configure<UploadSettings>(builder.Configuration.GetSection("UploadSettings"));
builder.Services.Configure<WebSocketSettings>(builder.Configuration.GetSection("WebSocketSettings"));
builder.Services.Configure<PortalAppsSettings>(builder.Configuration.GetSection("PortalAppsSettings"));

// ???? Serilog ???????????�I????????
//Log.Logger = new LoggerConfiguration()
//    .WriteTo.File("Logs/system-.log", // ??????��?????? rolling ????
//                  rollingInterval: RollingInterval.Day, // ????????????
//                  retainedFileCountLimit: 7, // ???????7??
//                  outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
//    .CreateLogger();
//builder.Host.UseSerilog();

// ???? CORS ????
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod()
            .WithExposedHeaders("Authorization", "Content-Disposition");
    });
});

// ??????????????????
var connStr = ConStrHelper.GetDecryptedConnectionString(builder.Configuration, "DefaultConnection");
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlServer(connStr));
//
var connOracle = ConStrHelper.GetDecryptedConnectionString(builder.Configuration, "OracleConnection");
builder.Services.AddDbContext<OracleDbContext>(options =>
    options.UseOracle(connOracle, oracleOptions =>
    {
        oracleOptions.UseOracleSQLCompatibility(OracleSQLCompatibility.DatabaseVersion19);
    }));

// ??? AutoMapper
builder.Services.AddAutoMapper(typeof(MappingProfile));

// ??? Repository ?? Service
builder.Services.AddScoped<IAzureService, AzureService>();
builder.Services.AddScoped<IiUserService, iUserService>();
builder.Services.AddScoped<JwtHelper>();
builder.Services.AddSingleton(sp =>
{
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    var appSettings = sp.GetRequiredService<IOptions<AppSettings>>().Value;
    var relative = string.IsNullOrWhiteSpace(appSettings.LocalUsersPath)
        ? "Data/local-users.json"
        : appSettings.LocalUsersPath;
    var path = Path.IsPathRooted(relative)
        ? relative
        : Path.Combine(env.ContentRootPath, relative);
    return new LocalUserStore(path);
});

//
builder.Services.AddScoped<IUserInfoRepository, UserInfoRepository>();
builder.Services.AddScoped<IUserInfoService, UserInfoService>();
builder.Services.AddScoped<IUserRoleRepository, UserRoleRepository>();
builder.Services.AddScoped<IUserRoleService, UserRoleService>();
builder.Services.AddScoped<IAgentRequestRepository, AgentRequestRepository>();
builder.Services.AddScoped<IAgentRequestService, AgentRequestService>();
builder.Services.AddScoped<IFileTreeRepository, FileTreeRepository>();
builder.Services.AddScoped<IFileTreeService, FileTreeService>();
builder.Services.AddScoped<IFeedbackRepository, FeedbackRepository>();
builder.Services.AddScoped<IFeedbackService, FeedbackService>();
builder.Services.AddScoped<ILaunchHandoffService, LaunchHandoffService>();

// ????????
builder.Services.AddSingleton<WebSocketConnectionManager>();

// ???? HTTP Client ???
builder.Services.AddHttpClient();

// ?????????
builder.Services.AddControllers();

// ???? Swagger ???
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "???��????? `Bearer + ??? + token`",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme{
                Reference = new OpenApiReference{
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[]{}
        }
    });
    // Swag ???
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    c.IncludeXmlComments(xmlPath);

});

// JWT ???��???
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"];
var issuer = jwtSettings["Issuer"];
var audience = jwtSettings["Audience"];
builder.Services.Configure<JwtSettings>(jwtSettings);
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,

        ValidIssuer = issuer,
        ValidAudience = audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        ClockSkew = TimeSpan.Zero // ????????????
    };
});

// ???? MemoryCache
builder.Services.AddMemoryCache();
// ???? Redis???????
builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var redisConfig = builder.Configuration["Redis:Connection"];
    return !string.IsNullOrEmpty(redisConfig)
        ? ConnectionMultiplexer.Connect(redisConfig)
        : null!;
});
// ??????? CacheHelper
builder.Services.AddSingleton<ICacheHelper, CacheHelper>();

#endregion

builder.Services.AddScoped<IExcelService, ExcelService>();
builder.Services.AddScoped<IPortalAppsService>(sp =>
{
    var opts = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<PortalAppsSettings>>().Value;
    var env = sp.GetRequiredService<IWebHostEnvironment>();
    return new PortalAppsService(opts, env.ContentRootPath);
});
builder.Services.AddHttpClient<IHttpBridgeService, HttpBridgeService>();

var app = builder.Build();

#region ==================== ?????��?? ====================
// Capture every unhandled API exception and write it through the shared LogHelper sink.
app.UseMiddleware<GlobalExceptionLoggingMiddleware>();

// WebSocket ????
var webSocketSettings = builder.Configuration.GetSection("WebSocketSettings").Get<WebSocketSettings>();
var webSocketOptions = new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(webSocketSettings.KeepAliveInterval)
};
app.UseWebSockets(webSocketOptions);
// ????��?????? WebSocket ????
app.UseMiddleware<WebSocketMiddleware>();

// ????????
app.UseDefaultFiles();
// .py 不在内置 MIME 表里，静态文件中间件会跳过它 → 404。Skill 附属 tool 源码需要可下载。
var staticContentTypeProvider = new FileExtensionContentTypeProvider();
staticContentTypeProvider.Mappings[".py"] = "text/plain";

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = staticContentTypeProvider,
    OnPrepareResponse = ctx =>
    {
        var path = ctx.Context.Request.Path.Value ?? string.Empty;
        if (!path.StartsWith("/apps/", StringComparison.OrdinalIgnoreCase))
            return;

        if (path.EndsWith("/index.html", StringComparison.OrdinalIgnoreCase))
        {
            ctx.Context.Response.Headers.CacheControl = "no-cache, max-age=0, must-revalidate";
            return;
        }

        if (path.Contains("/assets/", StringComparison.OrdinalIgnoreCase))
            ctx.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
    }
});

// ???? CORS
app.UseCors("AllowAll");

// ???? Swagger ???
app.UseSwagger();
app.UseSwaggerUI();

// ???? HTTPS ?????
app.UseHttpsRedirection();

// ??????? & ???
app.UseAuthentication();
app.UseAuthorization();

// ????????��??
app.MapControllers();

#endregion

// SPA fallback
app.MapFallbackToFile("index.html");

// ???????
app.Run();