-- Índices compuestos para listado paginado de miembros (BD corporativa)
CREATE INDEX `TenantMember_tenantId_status_idx` ON `TenantMember`(`tenantId`, `status`);
CREATE INDEX `TenantMember_tenantId_status_role_idx` ON `TenantMember`(`tenantId`, `status`, `role`);
