using AutoMapper;
using CommonService.Application.DTOs;
using CommonService.Core.Models;

namespace CommonService.Application.Mappings
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // UserInfo -> UserResponseDto
            CreateMap<UserInfo, UserResponseDto>()
                .ForSourceMember(src => src.Password, opt => opt.DoNotValidate())  // 忽略密码
                .ForMember(dest => dest.Roles, opt => opt.MapFrom(src => src.Roles.Select(r => r.UserRole)));
            CreateMap<UserRole, RoleDto>();

            // UserRole -> RoleResponseDto
            CreateMap<UserRole, RoleResponseDto>()
                .ForMember(dest => dest.Users, opt => opt.MapFrom(src => src.Users.Select(u => u.UserInfo)));
            CreateMap<UserInfo, UserDto>();
        }
    }
}
