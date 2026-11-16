(function attachPFMSRoleWorkflows(root) {
"use strict";
const ALL_VIEWS=Object.freeze(["dashboard","players","clubs","club-members","club-admin","club-scouting","teams","staff","scouts","team-workspace","reports","media","tasks","admin","agencies","admin-members","admin-errors","notifications","support","admin-inbox","admin-payments","backup","scout-workspace"]);
const SHARED_VIEWS=Object.freeze(["dashboard","media","tasks","notifications","support"]);
const PLATFORM_ADMIN_VIEWS=Object.freeze(ALL_VIEWS.filter(view=>!SHARED_VIEWS.includes(view)));
const MANAGER_ROLES=new Set(["owner","admin","manager","club_admin","agency_admin","president","praesident","vereinsleiter","vorstand"]);
const TEAM_ROLE_HINTS=new Set(["trainer","coach","co_trainer","cotrainer","betreuer"]);
function normalizeRole(value){return String(value||"").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[\s-]+/g,"_");}
function isActive(value){return ["approved","active"].includes(String(value||"").trim().toLowerCase());}
function resolveContext(input={}){
 const profileRole=normalizeRole(input.profileRole),isPlatformAdmin=["admin","administrator"].includes(profileRole);
 const organizations=Array.isArray(input.organizations)?input.organizations:[],teams=Array.isArray(input.teams)?input.teams:[];
 const manageableOrganizations=organizations.filter(org=>{const type=String(org?.organization_type||org?.type||"").toLowerCase(),status=org?.organization_status??org?.status,memberRole=normalizeRole(org?.member_role??org?.role);return ["club","agency"].includes(type)&&isActive(status)&&MANAGER_ROLES.has(memberRole);});
 const clubOrganizations=manageableOrganizations.filter(org=>String(org.organization_type||org.type||"").toLowerCase()==="club");
 const agencyOrganizations=manageableOrganizations.filter(org=>String(org.organization_type||org.type||"").toLowerCase()==="agency");
 const canManageClub=clubOrganizations.length>0,canManageAgency=agencyOrganizations.length>0,hasTeamAccess=teams.length>0;
 const isScout=profileRole.includes("scout"),isPlayer=["player","spieler"].includes(profileRole),hasTeamRoleHint=TEAM_ROLE_HINTS.has(profileRole);
 const allowedViews=new Set(SHARED_VIEWS);
 if(isPlatformAdmin)ALL_VIEWS.forEach(view=>allowedViews.add(view));
 else{
  if(canManageClub)["clubs","club-members","club-admin","club-scouting","teams","staff","team-workspace","scouts"].forEach(view=>allowedViews.add(view));
  if(canManageAgency)["agencies","club-members","club-scouting","scouts"].forEach(view=>allowedViews.add(view));
  if(isScout)["scouts","scout-workspace"].forEach(view=>allowedViews.add(view));
  if(hasTeamAccess)allowedViews.add("team-workspace");
 }
 let startView="dashboard";
 if(isPlatformAdmin)startView="admin";else if(canManageClub)startView="clubs";else if(canManageAgency)startView="agencies";else if(isScout)startView="scouts";else if(hasTeamAccess)startView="team-workspace";
 const roleLabel=isPlatformAdmin?"Administrator":canManageClub?"Vereinsverwaltung":canManageAgency?"Agenturverwaltung":isScout?"Scout":hasTeamAccess||hasTeamRoleHint?"Trainerteam":isPlayer?"Spieler":"Mitglied";
 return Object.freeze({profileRole,isPlatformAdmin,isScout,isPlayer,hasTeamRoleHint,hasTeamAccess,canManageClub,canManageAgency,hasManagementWorkspace:isPlatformAdmin||canManageClub||canManageAgency,clubOrganizationCount:clubOrganizations.length,agencyOrganizationCount:agencyOrganizations.length,manageableOrganizations:manageableOrganizations.slice(),allowedViews,startView,roleLabel});
}
function canAccessView(context,view){if(!context||!ALL_VIEWS.includes(view))return false;return context.isPlatformAdmin===true||context.allowedViews.has(view);}
function getStartView(context){return context&&canAccessView(context,context.startView)?context.startView:"dashboard";}
function getAllViews(){return ALL_VIEWS.slice();}
root.PFMSRoleWorkflows=Object.freeze({normalizeRole,resolveContext,canAccessView,getStartView,getAllViews,platformAdminViews:PLATFORM_ADMIN_VIEWS});
})(typeof window!=="undefined"?window:globalThis);
