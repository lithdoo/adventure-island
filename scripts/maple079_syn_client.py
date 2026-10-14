"""Task 032 P2: synthetic client for the local CMS079 login server (loopback only).

Protocol sources: the server JAR's handler/op-code tables (Task 032 P1) and the
Task 002-validated packet codec (scripts/maple079_packet.py). Not derived from
any protected client code.

Usage: python maple079_syn_client.py [--host 127.0.0.1] [--port 9555]
          [--user test1] [--pass test1] [--steps handshake,login,serverlist]
"""
from __future__ import annotations

import argparse
import socket
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import maple079_packet as _mp
from maple079_packet import (HANDSHAKE_PREFIX, encrypt_packet, decrypt_packet,
                             parse_handshake)

# Header version words: EMPIRICALLY CONFIRMED against the live local server
# (loopback): the client encrypts c2s packets with word 0x4F00 and the IV at
# hello[6:10]; decrypts s2c with 0xB0FF and the IV at hello[10:14]. The
# 15-byte hello is SERVER-FIRST (odinms sessionOpened) — the client must NOT
# send any handshake; sending one poisons the decoder and the session dies.
VERSION_WORD_C2S = 0x4F00
VERSION_WORD_S2C = 0xB0FF
_orig_version_word = _mp.version_word
_mp.version_word = lambda direction: (
    VERSION_WORD_C2S if direction == "c2s" else
    VERSION_WORD_S2C if direction == "s2c" else
    _orig_version_word(direction))

# Handshake bytes: the CMS079 client's fixed 15-byte opener (Task 002 evidence;
# [2B len=13][2B version=79 LE][2B 0000][4B sendIV][4B recvIV][1B locale=4]).
DEFAULT_HANDSHAKE = bytes.fromhex("0D004F00000046727A115230787A04")

# opcodes (extracted from the server JAR, result/task032-opcodes.csv)
C2S = {
    "LOGIN_PASSWORD": 0x0001,
    "LICENSE_REQUEST": 0x0004,
    "SERVERLIST_REQUEST": 0x0005,
    "CHARLIST_REQUEST": 0x0006,
    "SERVERSTATUS_REQUEST": 0x0007,
    "PONG": 0x0000,
}
S2C_NAMES = {
    0x0000: "LOGIN_ACCOUNT_INFO", 0x0001: "LOGIN_STATUS",
    0x0004: "SERVERLIST?", 0x0005: "SERVERSTATUS", 0x0006: "SERVERSTATUS2",
    0x0007: "CHARLIST", 0x0009: "SERVERLIST", 0x000D: "ALL_CHARLIST",
    0x000E: "CHOOSE_GENDER", 0x000F: "GENDER_SET",
}


def recv_packet(sock: socket.socket, iv: bytes, deadline: float = None) -> tuple:
    """Read one length-prefixed encrypted packet; returns (result_dict, next_iv)."""
    if deadline is None:
        deadline = time.time() + 6.0
    buf = b""
    while time.time() < deadline:
        try:
            chunk = sock.recv(4096)
        except OSError:
            break
        if not chunk:
            break
        buf += chunk
        if len(buf) >= 4:
            from maple079_packet import get_packet_length
            need = 4 + get_packet_length(buf[:4])
            if len(buf) >= need:
                res = decrypt_packet(buf[:need], iv, "s2c")
                return res, res["next_iv"], buf[need:]
        time.sleep(0.02)
    return None, iv, buf


def maple_str(text: str) -> bytes:
    raw = text.encode("ascii")
    return len(raw).to_bytes(2, "little") + raw


def build_login(user: str, password: str) -> bytes:
    # CharLoginHandler.login read sequence (confirmed from JAR bytecode):
    #   readMapleAsciiString (account)
    #   readMapleAsciiString (password)
    #   6x readByteAsInt (mac/hwid bytes, formatted to hex "XX-XX-XX-XX-XX-XX")
    opcode = C2S["LOGIN_PASSWORD"].to_bytes(2, "little")
    return (opcode + maple_str(user) + maple_str(password) + bytes(6))


def build_serverlist(world: int = 0) -> bytes:
    return C2S["SERVERLIST_REQUEST"].to_bytes(2, "little") + bytes([world])


def build_charlist(world: int = 0, channel: int = 0) -> bytes:
    # odinms: opcode + byte world + byte channel (some builds: only channel)
    return C2S["CHARLIST_REQUEST"].to_bytes(2, "little") + bytes([channel, world])


def run(args) -> int:
    print(f"[syn] connecting {args.host}:{args.port}")
    sock = socket.create_connection((args.host, args.port), timeout=6)
    sock.settimeout(6.0)

    # -- step 1: SERVER-FIRST hello (do not send anything before it) --
    hello = b""
    while len(hello) < 15:
        chunk = sock.recv(64)
        if not chunk:
            break
        hello += chunk
    print(f"[syn] server hello ({len(hello)}B): {hello.hex()}")
    if len(hello) < 15:
        print("[syn] no server hello — abort")
        return 1
    version = int.from_bytes(hello[2:4], "little")
    c2s_iv = hello[6:10]      # IV the client encrypts with (empirical)
    s2c_iv = hello[10:14]     # IV the client decrypts with (empirical)
    locale = hello[14]
    print(f"[syn] hello: version={version} locale={locale} "
          f"c2s_iv={c2s_iv.hex()} s2c_iv={s2c_iv.hex()}")

    transcript = [{"dir": "s->c", "kind": "hello", "hex": hello.hex(),
                   "version": version, "s2c_iv": s2c_iv.hex(),
                   "c2s_iv": c2s_iv.hex()}]

    # -- step 3: login --
    if "login" in args.steps:
        pkt, c2s_iv = encrypt_packet(
            build_login(args.user, args.password), c2s_iv, "c2s")
        sock.sendall(pkt)
        print(f"[syn] LOGIN_PASSWORD({args.user}) sent: {pkt.hex()}")
        transcript.append({"dir": "c->s", "kind": "LOGIN_PASSWORD", "hex": pkt.hex()})
        res, s2c_iv, pending = recv_packet(sock, s2c_iv)
        if res is None:
            print("[syn] no reply to login (pending:", pending.hex() if pending else "", ")")
        else:
            name = S2C_NAMES.get(res["opcode_dec"], "?")
            print(f"[syn] reply {name} (0x{res['opcode_dec']:04X}): {res['plaintext_hex']}")
            transcript.append({"dir": "s->c", "kind": name,
                               "opcode": res["opcode_hex"],
                               "plaintext": res["plaintext_hex"]})
            # drain anything else (e.g. PING) briefly
            extra, s2c_iv, _ = recv_packet(sock, s2c_iv, deadline=time.time() + 2)
            if extra:
                name2 = S2C_NAMES.get(extra["opcode_dec"], "?")
                print(f"[syn] extra {name2} (0x{extra['opcode_dec']:04X}): "
                      f"{extra['plaintext_hex'][:80]}")
                transcript.append({"dir": "s->c", "kind": name2,
                                   "opcode": extra["opcode_hex"],
                                   "plaintext": extra["plaintext_hex"]})

    # -- step 4: server list --
    if "serverlist" in args.steps:
        pkt, c2s_iv = encrypt_packet(build_serverlist(0), c2s_iv, "c2s")
        sock.sendall(pkt)
        print(f"[syn] SERVERLIST_REQUEST sent")
        res, s2c_iv, _ = recv_packet(sock, s2c_iv)
        if res:
            name = S2C_NAMES.get(res["opcode_dec"], "?")
            print(f"[syn] reply {name} (0x{res['opcode_dec']:04X}): "
                  f"{res['plaintext_hex'][:160]}")
            transcript.append({"dir": "c->s/s->c", "kind": name,
                               "opcode": res["opcode_hex"],
                               "plaintext": res["plaintext_hex"]})
            # server often sends world list end packet too
            extra, s2c_iv, _ = recv_packet(sock, s2c_iv, deadline=time.time() + 2)
            if extra:
                name2 = S2C_NAMES.get(extra["opcode_dec"], "?")
                print(f"[syn] extra {name2} (0x{extra['opcode_dec']:04X}): "
                      f"{extra['plaintext_hex'][:160]}")
                transcript.append({"dir": "s->c", "kind": name2,
                                   "opcode": extra["opcode_hex"],
                                   "plaintext": extra["plaintext_hex"]})

    sock.close()
    Path(args.transcript).write_text(
        "\n".join(str(t) for t in transcript), encoding="utf-8")
    print(f"[syn] transcript -> {args.transcript}")
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="CMS079 synthetic client (loopback only)")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=9555)
    p.add_argument("--user", default="fl1234")
    p.add_argument("--pass", dest="password", default="123456")
    p.add_argument("--steps", default="handshake,login,serverlist")
    p.add_argument("--transcript", default="syn-transcript.txt")
    args = p.parse_args(argv)
    args.steps = [s.strip() for s in args.steps.split(",") if s.strip()]
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
