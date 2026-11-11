-- These RPCs require a verified authenticated actor; anonymous execution must not remain via PUBLIC defaults.
revoke execute on function public.create_community_post(text,text,uuid,uuid),public.equip_cosmetic(uuid),public.send_friend_request(uuid) from anon;
grant execute on function public.create_community_post(text,text,uuid,uuid),public.equip_cosmetic(uuid),public.send_friend_request(uuid) to authenticated;
