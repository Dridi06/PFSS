/* PFSS organization member management – tenant-scoped UI */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const state = { organizations: [], selectedOrg: '', members: [], invitations: [], inviteUrl: '' };
  const roleLabels = { owner:'Inhaber', admin:'Administrator', scout:'Scout', coach:'Trainer', analyst:'Analyst', finance:'Finanzen', viewer:'Mitglied' };
  const statusLabels = { active:'Aktiv', invited:'Eingeladen', suspended:'Gesperrt', removed:'Entfernt' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const client = () => pfssSupabase;
  function say(message, error=false) { const el=$('pfssMemberMessage'); if(el){el.textContent=message;el.classList.toggle('auth-message-error',error);} }
  function selectedOrg() { return state.organizations.find(o=>o.id===state.selectedOrg); }
  async function loadOrganizations() {
    const {data,error}=await client().from('pfss_organizations').select('id,name,organization_type,status').order('name');
    if(error) throw error;
    state.organizations=data||[];
    const select=$('pfssMemberOrg');
    if(!select)return;
    const previous=state.selectedOrg;
    select.innerHTML=state.organizations.map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name)+' · '+esc(o.organization_type)+'</option>').join('');
    if(state.organizations.some(o=>o.id===previous))select.value=previous;
    state.selectedOrg=select.value||'';
    if(!state.selectedOrg){$('pfssMembersHost').innerHTML='<div class="empty-state"><b>Keine Organisation vorhanden</b><p>Lege zuerst im Bereich Vereinsübersicht einen Verein an.</p></div>';return;}
    await loadAll();
  }
  async function loadAll() {
    if(!state.selectedOrg)return;
    say('Mitglieder und Einladungen werden geladen …');
    const [m,i]=await Promise.all([
      client().rpc('pfss_org_list_members',{p_organization_id:state.selectedOrg}),
      client().rpc('pfss_org_list_invitations',{p_organization_id:state.selectedOrg})
    ]);
    if(m.error)throw m.error;if(i.error)throw i.error;
    state.members=m.data||[];state.invitations=i.data||[];
    render();
    say('Daten aktuell · '+state.members.filter(x=>x.member_status==='active').length+' aktive Mitglieder');
  }
  function render() {
    const host=$('pfssMembersHost'), invites=$('pfssInvitesHost');
    const q=($('pfssMemberSearch')?.value||'').trim().toLocaleLowerCase('de');
    const rows=state.members.filter(m=>[m.username,m.display_name,m.email,m.member_role].some(v=>String(v||'').toLocaleLowerCase('de').includes(q)));
    $('pfssMemberCount').textContent=String(state.members.filter(m=>m.member_status==='active').length);
    $('pfssInviteCount').textContent=String(state.invitations.filter(x=>!x.accepted&&!x.revoked&&new Date(x.expires_at)>new Date()).length);
    host.innerHTML=rows.length?rows.map(m=>{
      const protectedOwner=m.member_role==='owner';
      const options=Object.keys(roleLabels).filter(r=>r!=='owner').map(r=>'<option value="'+r+'" '+(m.member_role===r?'selected':'')+'>'+roleLabels[r]+'</option>').join('');
      return '<article class="pfss-member-row"><div class="pfss-member-identity"><span class="pfss-member-avatar">'+esc((m.display_name||m.username||m.email||'PF').trim().slice(0,2).toUpperCase())+'</span><div><b>'+esc(m.display_name||m.username||'Ohne Profilnamen')+'</b><small>'+esc(m.email||m.username||m.user_id)+'</small><small>Seit '+new Date(m.joined_at).toLocaleDateString('de-DE')+'</small></div></div><div class="pfss-member-controls"><span class="pfss-role-pill">'+esc(roleLabels[m.member_role]||m.member_role)+'</span><span class="pfss-status-pill '+esc(m.member_status)+'">'+esc(statusLabels[m.member_status]||m.member_status)+'</span>'+(protectedOwner?'<span class="pfss-protected">Geschützt</span>':'<label class="pfss-inline-field"><span>Rolle</span><select data-member-role="'+esc(m.membership_id)+'">'+options+'</select></label><label class="pfss-inline-field"><span>Status</span><select data-member-status="'+esc(m.membership_id)+'"><option value="active" '+(m.member_status==='active'?'selected':'')+'>Aktiv</option><option value="suspended" '+(m.member_status==='suspended'?'selected':'')+'>Gesperrt</option></select></label><button class="btn btn-secondary pfss-small-btn" data-save-member="'+esc(m.membership_id)+'">Speichern</button><button class="btn btn-danger pfss-small-btn" data-remove-member="'+esc(m.membership_id)+'">Entfernen</button>')+'</div></article>';
    }).join(''):'<div class="empty-state"><b>Keine passenden Mitglieder</b><p>Ändere den Suchbegriff oder lade die Liste neu.</p></div>';
    invites.innerHTML=state.invitations.length?state.invitations.map(i=>{
      const status=i.accepted?'Angenommen':i.revoked?'Widerrufen':new Date(i.expires_at)<new Date()?'Abgelaufen':'Offen';
      return '<article class="pfss-invite-row"><div><b>'+esc(i.email==='*'?'Offene Einladung':i.email)+'</b><small>'+esc(roleLabels[i.invite_role]||i.invite_role)+' · gültig bis '+new Date(i.expires_at).toLocaleString('de-DE')+'</small></div><span class="pfss-status-pill">'+status+'</span>'+(status==='Offen'?'<button class="btn btn-secondary pfss-small-btn" data-revoke-invite="'+esc(i.invitation_id)+'">Widerrufen</button>':'')+'</article>';
    }).join(''):'<div class="empty-state"><b>Noch keine Einladungen</b><p>Erstelle eine Einladung, um Mitglieder sicher aufzunehmen.</p></div>';
  }
  async function createInvite(event) {
    event.preventDefault();
    const button=$('pfssInviteButton');button.disabled=true;
    try {
      const role=$('pfssInviteRole').value, days=Number($('pfssInviteDays').value);
      const {data,error}=await client().rpc('pfms_create_legacy_invitation',{p_organization_id:state.selectedOrg,p_role:role,p_expires_in_days:days});
      if(error)throw error;
      const url=new URL(window.location.href);url.search='';url.hash='';url.searchParams.set('invite',data);
      state.inviteUrl=url.toString();
      $('pfssInviteResult').hidden=false;
      $('pfssInviteLink').value=state.inviteUrl;
      say('Einladung erstellt. Den Link jetzt kopieren und sicher an die Person senden.');
      await loadAll();
    } catch(e) { say('Einladung konnte nicht erstellt werden: '+(e.message||'Berechtigung oder Datenbank prüfen.'),true); }
    finally {button.disabled=false;}
  }
  document.addEventListener('click',async event=>{
    const save=event.target.closest('[data-save-member]');
    const remove=event.target.closest('[data-remove-member]');
    const revoke=event.target.closest('[data-revoke-invite]');
    try {
      if(save){
        const id=save.dataset.saveMember, role=document.querySelector('[data-member-role="'+id+'"]').value, status=document.querySelector('[data-member-status="'+id+'"]').value;
        save.disabled=true;const {error}=await client().rpc('pfss_org_update_member',{p_membership_id:id,p_role:role,p_status:status});if(error)throw error;
        say('Mitgliedsrolle und Status wurden gespeichert.');await loadAll();
      } else if(remove){
        if(!confirm('Mitglied wirklich aus dieser Organisation entfernen?'))return;
        const {error}=await client().rpc('pfss_org_remove_member',{p_membership_id:remove.dataset.removeMember});if(error)throw error;
        say('Mitglied wurde aus der Organisation entfernt.');await loadAll();
      } else if(revoke){
        if(!confirm('Diese Einladung wirklich widerrufen?'))return;
        const {error}=await client().rpc('pfss_org_revoke_invitation',{p_invitation_id:revoke.dataset.revokeInvite});if(error)throw error;
        say('Einladung wurde widerrufen.');await loadAll();
      }
    } catch(e){say('Aktion fehlgeschlagen: '+(e.message||'Bitte Berechtigungen prüfen.'),true);}
  });
  document.addEventListener('change',event=>{if(event.target.id==='pfssMemberOrg'){state.selectedOrg=event.target.value;loadAll().catch(e=>say('Laden fehlgeschlagen: '+e.message,true));}});
  document.addEventListener('input',event=>{if(event.target.id==='pfssMemberSearch')render();});
  $('pfssInviteForm')?.addEventListener('submit',createInvite);
  $('pfssCopyInvite')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.inviteUrl);say('Einladungslink kopiert.');}catch(e){$('pfssInviteLink').select();say('Bitte den markierten Link manuell kopieren.');}});
  $('pfssMemberReload')?.addEventListener('click',()=>loadAll().catch(e=>say('Aktualisierung fehlgeschlagen: '+e.message,true)));
  document.addEventListener('click',event=>{const nav=event.target.closest('[data-view="club-members"]');if(nav)setTimeout(()=>loadOrganizations().catch(e=>say('Mitgliederverwaltung konnte nicht geladen werden: '+e.message,true)),0);});
  window.pfssLoadOrganizationMembers=()=>loadOrganizations().catch(e=>say('Mitgliederverwaltung konnte nicht geladen werden: '+e.message,true));
})();
