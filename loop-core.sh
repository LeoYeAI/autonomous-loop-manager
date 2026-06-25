#!/bin/bash
# autonomous-loop-manager v2 core engine
# 覆盖 v1 入口，新增所有 v2 控制面模块

SKILL_DIR="$HOME/.openclaw/workspace/skills/autonomous-loop-manager"
TOOLS_DIR="$SKILL_DIR/tools"
NODE_BIN="node"

case "$1" in
  # ── v2 控制面 ──────────────────────────────────────────────
  quota)
    shift; "$NODE_BIN" "$TOOLS_DIR/quota.js" "$@" ;;
  todo)
    shift; "$NODE_BIN" "$TOOLS_DIR/todo.js" "$@" ;;
  gate)
    shift; "$NODE_BIN" "$TOOLS_DIR/gate.js" "$@" ;;
  evidence)
    shift; "$NODE_BIN" "$TOOLS_DIR/evidence.js" "$@" ;;
  scope)
    shift; "$NODE_BIN" "$TOOLS_DIR/scope.js" "$@" ;;
  daily-review)
    shift; "$NODE_BIN" "$TOOLS_DIR/daily-review.js" "$@" ;;
  cron-bridge)
    shift; "$NODE_BIN" "$TOOLS_DIR/cron-bridge.js" "$@" ;;
  # ── 目标管理 ───────────────────────────────────────────────
  goal-track)
    shift; "$NODE_BIN" "$TOOLS_DIR/goal-track.js" "$@" ;;
  # ── v1 语义记忆层（保留）──────────────────────────────────
  reflect)
    shift; "$NODE_BIN" "$TOOLS_DIR/reflect.js" "$@" ;;
  strategy)
    shift; "$NODE_BIN" "$TOOLS_DIR/strategy.js" "$@" ;;
  recall)
    shift; "$NODE_BIN" "$TOOLS_DIR/recall.js" "$@" ;;
  plan)
    shift; "$NODE_BIN" "$TOOLS_DIR/plan.js" "$@" ;;
  status)
    shift; "$NODE_BIN" "$TOOLS_DIR/status.js" "$@" ;;
  # ── 快捷命令 ───────────────────────────────────────────────
  # loop start <goal> <user> [objective]  一键启动新目标
  start)
    shift
    GOAL_TEXT="$1"; USER_ID="$2"; OBJECTIVE="${3:-$1}"
    RESULT=$("$NODE_BIN" "$TOOLS_DIR/goal-track.js" create "$GOAL_TEXT" "$USER_ID" "$OBJECTIVE")
    GOAL_ID=$(echo "$RESULT" | grep goal_id | sed 's/.*: "//;s/".*//')
    echo "$RESULT"
    "$NODE_BIN" "$TOOLS_DIR/scope.js" init "$GOAL_ID"
    echo "✅ 目标已创建。接下来："
    echo "  1. 添加 todo:  loop todo add $GOAL_ID --title '...' --priority P0 --success_criteria '...'"
    echo "  2. 接入心跳:  loop cron-bridge setup $GOAL_ID 180000"
    ;;
  # loop check <goal_id>  快速看当前状态
  check)
    shift; GOAL_ID="$1"
    echo "=== Quota ==="
    "$NODE_BIN" "$TOOLS_DIR/quota.js" should-run "$GOAL_ID"
    echo ""
    echo "=== ACTIVE_STATE ==="
    cat "$SKILL_DIR/memory/goals/$GOAL_ID/ACTIVE_STATE.md" 2>/dev/null || echo "(未找到 ACTIVE_STATE.md)"
    ;;
  # loop writeback <goal_id> <todo_id> <outcome> <summary> <next>
  writeback)
    shift
    GOAL_ID="$1"; TODO_ID="$2"; OUTCOME="${3:-outcome_progress}"
    SUMMARY="${4:-完成}"; NEXT="${5:-见ACTIVE_STATE}"
    "$NODE_BIN" "$TOOLS_DIR/todo.js" complete "$GOAL_ID" "$TODO_ID" "session" "$SUMMARY"
    "$NODE_BIN" "$TOOLS_DIR/evidence.js" record "$GOAL_ID" \
      --classification advancement \
      --delivery_outcome "$OUTCOME" \
      --validation_summary "$SUMMARY" \
      --next_action "$NEXT" \
      --todos_completed "$TODO_ID"
    "$NODE_BIN" "$TOOLS_DIR/goal-track.js" refresh-state "$GOAL_ID"
    ;;
  help|--help|-h)
    cat <<'EOF'
🌀 Autonomous Loop Manager v2

Usage: loop <command> [args]

── v2 控制面 ──────────────────────────────────
  quota should-run <goal_id>              每轮入口：该不该跑？
  todo add <goal_id> --title "..." ...    添加带契约的工作单元
  todo claim <goal_id> <todo_id> <who>    认领 todo
  todo complete <goal_id> <id> <who> <e>  完成 todo（带证据）
  todo list-actionable <goal_id>          列出可执行的 todo
  gate add <goal_id> --question "..." ... 添加用户决策点
  gate answer <goal_id> <gate_id> <ans>   回答决策点
  gate list-open <goal_id>               列出未解决的 gate
  evidence record <goal_id> --classification ... 记录执行证据
  evidence stats <goal_id> [hours]        统计近期进展
  scope init <goal_id>                    初始化边界配置
  scope check <goal_id> "<动作>"          检查动作是否在边界内
  daily-review summary [user_id]          今日进展摘要

── 目标管理 ──────────────────────────────────
  goal-track create <text> <user> [obj]   创建目标
  goal-track set <goal_id> <field> <val>  更新字段
  goal-track refresh-state <goal_id>      刷新 ACTIVE_STATE.md
  goal-track complete <goal_id>           标记完成

── v1 语义记忆层 ─────────────────────────────
  recall manifest <user_id>               一行式记忆清单
  strategy add <ctx> <strategy>           记录有效策略
  reflect write <goal_id> <r> <o> <sum>   写反思

── 快捷命令 ──────────────────────────────────
  start <goal> <user_id> [objective]      一键启动目标
  check <goal_id>                         快速看状态
  writeback <goal_id> <todo_id> <outcome> <summary> <next>
  cron-bridge setup <goal_id> [ms]        生成心跳 cron payload
  cron-bridge heartbeat-prompt <goal_id>  生成单次心跳 prompt
EOF
    ;;
  *)
    echo "Usage: loop <command> [args]"
    echo "Run 'loop help' for full command list."
    ;;
esac
