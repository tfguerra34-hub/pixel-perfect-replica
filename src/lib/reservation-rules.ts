function minutes(value: string) {
  const [hours = 0, mins = 0] = value.split(":").map(Number);
  return hours * 60 + mins;
}

/** True when the full reservation duration intersects a block. Null times mean a full-day block. */
export function reservationOverlapsBlock(reservationTime: string, durationMinutes: number, blockStart: string | null, blockEnd: string | null) {
  if (!blockStart || !blockEnd) return true;
  const start = minutes(reservationTime);
  return start < minutes(blockEnd) && start + durationMinutes > minutes(blockStart);
}

export function reservationErrorMessage(message: string | undefined, fallback = "Não foi possível guardar a reserva.") {
  if (!message) return fallback;
  if (message.includes("MESA_COM_RESERVAS:")) return message.replace(/^.*MESA_COM_RESERVAS:\s*/, "");
  if (message.includes("MESA_OCUPADA")) return "Esta mesa já está reservada num horário que coincide com a ocupação. Escolha outra mesa ou horário.";
  if (message.includes("RESERVA_SEM_MESA")) return "Não existe uma mesa livre com lugares suficientes neste horário.";
  if (message.includes("MESA_INVALIDA")) return "A mesa escolhida está inativa ou não tem lugares suficientes.";
  if (message.includes("HORARIO_BLOQUEADO")) return "Esta reserva coincide com um bloqueio do restaurante ou da mesa.";
  if (message.includes("LIMITE_PESSOAS")) return "Este horário atingiu o número máximo de pessoas definido.";
  if (message.includes("GRUPO_INVALIDO")) return "Indique um número válido de pessoas.";
  return fallback;
}
