-- Revoke the implicit PUBLIC privilege as well as anon; explicit authenticated grants remain.
revoke execute on function public.create_community_post(text,text,uuid,uuid),public.equip_cosmetic(uuid),public.send_friend_request(uuid) from public,anon;
grant execute on function public.create_community_post(text,text,uuid,uuid),public.equip_cosmetic(uuid),public.send_friend_request(uuid) to authenticated;
