-- Generated test identities only. The complete transaction is rolled back.
begin;
do $$
declare inviter uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); invitee uuid:=gen_random_uuid(); verified uuid:=gen_random_uuid(); invalid uuid:=gen_random_uuid(); unknown_user uuid:=gen_random_uuid(); existing uuid:=gen_random_uuid(); removed_inviter uuid:=gen_random_uuid(); orphan uuid:=gen_random_uuid(); code text; other_code text; orphan_code text; handle text:='ref_'||substr(md5(random()::text),1,8); first_notice uuid;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(inviter,inviter::text||'@example.invalid',jsonb_build_object('username',handle||'_a')),(other,other::text||'@example.invalid',jsonb_build_object('username',handle||'_b'));
 perform set_config('request.jwt.claim.sub',inviter::text,true);
 execute 'set local role authenticated';code:=public.get_my_invite_code();if public.get_my_invite_code()<>code then raise exception 'Code changed on repeat copy';end if;execute 'reset role';
 perform set_config('request.jwt.claim.sub',other::text,true);
 execute 'set local role authenticated';other_code:=public.get_my_invite_code();execute 'reset role';
 if other_code=code then raise exception 'Users share an invite code';end if;
 insert into auth.users(id,email,raw_user_meta_data) values(invitee,invitee::text||'@example.invalid',jsonb_build_object('username',handle||'_c','favorite_commander','The Ur-Dragon','invite_code',code));
 if not exists(select 1 from private.player_referrals where invitee_id=invitee and inviter_id=inviter and confirmed_at is null) then raise exception 'Signup attribution missing';end if;
 if exists(select 1 from public.friend_connections where recipient_id=invitee or requester_id=invitee) or exists(select 1 from public.friend_notifications where actor_id=invitee) then raise exception 'Unverified signup credited early';end if;
 -- Changing user metadata cannot transfer original inviter credit.
 update auth.users set raw_user_meta_data=raw_user_meta_data||jsonb_build_object('invite_code',other_code),email_confirmed_at=now() where id=invitee;
 if not exists(select 1 from private.player_referrals where invitee_id=invitee and inviter_id=inviter and confirmed_at is not null) then raise exception 'Confirmed attribution lost/changed';end if;
 if not exists(select 1 from public.friend_connections where requester_id=inviter and recipient_id=invitee and status='accepted') then raise exception 'Verified invite did not create friendship';end if;
 select id into first_notice from public.friend_notifications where user_id=inviter and actor_id=invitee and kind='invite_joined';
 if first_notice is null or (select count(*) from public.friend_notifications where actor_id=invitee or user_id=invitee)<>1 then raise exception 'Wrong/multiple join notifications';end if;
 perform set_config('request.jwt.claim.sub',inviter::text,true);
 if not exists(select 1 from public.list_friend_notifications() where id=first_notice and kind='invite_joined') then raise exception 'Join notification missing from API';end if;
 update auth.users set email_confirmed_at=now() where id=invitee;
 if (select count(*) from public.friend_notifications where user_id=inviter and actor_id=invitee and kind='invite_joined')<>1 then raise exception 'Duplicate join credit';end if;
 perform public.friend_action(handle||'_c','remove');
 update auth.users set email_confirmed_at=now() where id=invitee;
 if exists(select 1 from public.friend_connections where recipient_id=invitee or requester_id=invitee) then raise exception 'Confirmation restored removed friendship';end if;
 if not exists(select 1 from private.player_referrals where invitee_id=invitee and inviter_id=inviter and confirmed_at is not null) then raise exception 'Unfriend removed future badge history';end if;
 -- Already-verified signup paths finalize once, without needing a later login.
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(verified,verified::text||'@example.invalid',now(),jsonb_build_object('username',handle||'_d','invite_code',code));
 if not exists(select 1 from private.player_referrals where invitee_id=verified and confirmed_at is not null) then raise exception 'Already-verified signup not finalized';end if;
 insert into auth.users(id,email,raw_user_meta_data) values(invalid,invalid::text||'@example.invalid',jsonb_build_object('invite_code','bad-code')),(unknown_user,unknown_user::text||'@example.invalid',jsonb_build_object('invite_code',gen_random_uuid())),(existing,existing::text||'@example.invalid','{}');
 update auth.users set raw_user_meta_data=jsonb_build_object('invite_code',code),email_confirmed_at=now() where id=existing;
 if exists(select 1 from private.player_referrals where invitee_id in(invalid,unknown_user,existing)) then raise exception 'Invalid code or existing account received credit';end if;
 -- A deleted inviter must never prevent the invitee confirming their account.
 insert into auth.users(id,email,raw_user_meta_data) values(removed_inviter,removed_inviter::text||'@example.invalid','{}');
 perform set_config('request.jwt.claim.sub',removed_inviter::text,true);orphan_code:=public.get_my_invite_code();
 insert into auth.users(id,email,raw_user_meta_data) values(orphan,orphan::text||'@example.invalid',jsonb_build_object('invite_code',orphan_code));
 delete from auth.users where id=removed_inviter;
 update auth.users set email_confirmed_at=now() where id=orphan;
 if not exists(select 1 from private.player_referrals where invitee_id=orphan and inviter_id is null and confirmed_at is not null) then raise exception 'Deleted inviter handling failed';end if;
 if has_table_privilege('authenticated','private.player_referrals','SELECT') or has_table_privilege('authenticated','private.player_referrals','INSERT') or has_table_privilege('anon','private.player_invite_codes','SELECT') or has_function_privilege('authenticated','private.complete_player_referral(uuid)','EXECUTE') or has_function_privilege('anon','public.get_my_invite_code()','EXECUTE') then raise exception 'Referral internals exposed';end if;
 raise notice 'PASS unique stable owner codes, pending signup attribution, email-confirmed friendship/notification, no duplicates, immutable inviter, unfriend history, verified signup, invalid/unknown codes, existing account exclusion, deleted inviter and private grants';
end $$;
rollback;
