import { StyleSheet, Text, View } from "react-native";

const ChooseScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Choose Screen</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  text: {
    marginTop: 16,
    textAlign: 'center',
    color: '#ffffff',
  },
});

export default ChooseScreen;
