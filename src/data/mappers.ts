// DB row(snake_case) → 도메인 객체(camelCase) 매핑
import type {
  Bottle,
  ChatMessage,
  ChatRoom,
  Profile,
  Reply,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function toProfile(r: any): Profile {
  return {
    id: r.id,
    tossUserKey: r.toss_user_key ?? null,
    nickname: r.nickname ?? null,
    anonNo: r.anon_no ?? null,
    gender: r.gender ?? null,
    ageBand: r.age_band ?? null,
    nationality: r.nationality ?? null,
    createdAt: r.created_at,
  };
}

export function toBottle(r: any): Bottle {
  return {
    id: r.id,
    authorId: r.author_id,
    recipientId: r.recipient_id,
    content: r.content,
    authorGender: r.author_gender ?? null,
    authorAgeBand: r.author_age_band ?? null,
    authorNationality: r.author_nationality ?? null,
    authorAnonNo: r.author_anon_no ?? null,
    status: r.status,
    receivedAt: r.received_at ?? null,
    createdAt: r.created_at,
  };
}

export function toReply(r: any): Reply {
  return {
    id: r.id,
    bottleId: r.bottle_id,
    fromId: r.from_id,
    toId: r.to_id,
    content: r.content,
    status: r.status,
    createdAt: r.created_at,
  };
}

export function toChatRoom(r: any): ChatRoom {
  return {
    id: r.id,
    bottleId: r.bottle_id,
    replyId: r.reply_id,
    userA: r.user_a,
    userB: r.user_b,
    createdAt: r.created_at,
  };
}

export function toChatMessage(r: any): ChatMessage {
  return {
    id: r.id,
    roomId: r.room_id,
    senderId: r.sender_id,
    content: r.content,
    createdAt: r.created_at,
  };
}
