const int PIR_PIN = 27;
const int CURRENT_PIN = 34;
const int STORE_STATE_PIN = 26;
const int RELAY_PIN = 25;
const int BUZZER_PIN = 33;

const int CURRENT_THRESHOLD = 3000;
const unsigned long STATUS_INTERVAL_MS = 1000;

unsigned long lastStatusAt = 0;
bool relayOn = true;

void setRelay(bool enabled) {
  relayOn = enabled;
  digitalWrite(RELAY_PIN, enabled ? HIGH : LOW);
}

void printStatus(bool storeClosed, bool presenceDetected, int currentValue,
                 bool abnormalCurrent) {
  Serial.print("store=");
  Serial.print(storeClosed ? "CLOSED" : "OPEN");
  Serial.print(" presence=");
  Serial.print(presenceDetected ? "YES" : "NO");
  Serial.print(" current=");
  Serial.print(currentValue);
  Serial.print(" relay=");
  Serial.print(relayOn ? "ON" : "OFF");
  Serial.print(" abnormal_current=");
  Serial.println(abnormalCurrent ? "YES" : "NO");
}

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  pinMode(STORE_STATE_PIN, INPUT);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  setRelay(true);

  Serial.println("Topic 55 Week 2 Wokwi simulation");
  Serial.println("Set switch CLOSED, trigger PIR, and turn the potentiometer to test.");
}

void loop() {
  const bool storeClosed = digitalRead(STORE_STATE_PIN) == HIGH;
  const bool presenceDetected = digitalRead(PIR_PIN) == HIGH;
  const int currentValue = analogRead(CURRENT_PIN);
  const bool abnormalCurrent = currentValue > CURRENT_THRESHOLD;

  if (storeClosed && !presenceDetected && relayOn) {
    setRelay(false);
    Serial.println("AUTO_SHUTDOWN: CLOSED + NO PRESENCE -> relay OFF, load LED OFF");
  } else if ((!storeClosed || presenceDetected) && !relayOn) {
    setRelay(true);
    Serial.println("LOAD_RESTORE: store open or presence detected -> relay ON");
  }

  if (abnormalCurrent) {
    tone(BUZZER_PIN, 1800, 150);
  } else {
    noTone(BUZZER_PIN);
  }

  if (millis() - lastStatusAt >= STATUS_INTERVAL_MS) {
    lastStatusAt = millis();
    printStatus(storeClosed, presenceDetected, currentValue, abnormalCurrent);
  }
}
