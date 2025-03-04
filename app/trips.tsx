import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Modal,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "@/lib/supabase";
import { FontAwesome } from "@expo/vector-icons";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "@/context/AuthProvider";

import moment from "moment";
import { Button } from "@rneui/base";

const { width } = Dimensions.get("window");

const nonCryptoUUID = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

export default function TripsScreen() {
  const router = useRouter();
  const { chatId, chatName } = useLocalSearchParams(); // Chat ID & Name from params
  const [trips, setTrips] = useState<any[]>([]);
  const [newTripName, setNewTripName] = useState("");
  const [startingLocation, setStartingLocation] = useState("");
  const [tripModalVisible, setTripModalVisible] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (chatId) {
      fetchTrips();
    }
  }, [chatId]);

  const handleDateChange = (event, selectedDate, isStart) => {
    if (selectedDate) {
      if (isStart) {
        setStartDate(selectedDate);
        setShowStartPicker(false);
      } else {
        setEndDate(selectedDate);
        setShowEndPicker(false);
      }
    }
  };

  /** 📌 Fetch trips for this chat */
  async function fetchTrips() {
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false });
    if (!error) {
      setTrips(data);
    }
  }

  /** 📌 Create a new trip */
  const handleCreateTrip = async () => {
    if (!newTripName.trim()) {
      return Alert.alert("Error", "Trip name required.");
    }

    const newTripId = nonCryptoUUID();
    const newId = nonCryptoUUID();

    const { error } = await supabase.from("trips").insert([
      {
        id: newTripId,
        chat_id: chatId,
        creator_id: user.id,
        name: newTripName,
        created_at: new Date().toISOString(),
        start_date: startDate.toISOString(), // ✅ Store start date with time
        end_date: endDate.toISOString(), // ✅ Store end date with time
      },
    ]);

    // ✅Fetch all users in the chat
    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("chat_id", chatId);

    if (membersError) throw membersError;
    if (!members || members.length === 0) {
      return Alert.alert("Error", "No users found in this chat.");
    }
    // ✅ Step 3: Add all users to the trip
    const participantsData = members.map((member) => ({
      id: nonCryptoUUID(), // Unique ID for each participant
      trip_id: newTripId,
      user_id: member.user_id,
      starting_location: "Not set", // Default value
      latitude: null, // Default
      longitude: null, // Default
      joined_at: new Date().toISOString(),
    }));

    const { error: participantsError } = await supabase
      .from("trip_participants")
      .insert(participantsData);

    if (participantsError) throw participantsError;

    if (!error) {
      setNewTripName("");
      setStartingLocation("");
      setTripModalVisible(false);
      fetchTrips();
      fetchTrips(selectedChat.id);
    }
  };

  return (
    <View className="flex-1 bg-gray-100">
      {/* 📌 Header */}
      <View className="flex-row items-center px-6 py-16 bg-orange-500 shadow-lg">
        <TouchableOpacity onPress={() => router.back()} className="p-2">
          <FontAwesome name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-white ml-4">{chatName}</Text>
      </View>

      {/* 📌 List of Trips */}
      <FlatList
        className="flex-1 w-full"
        data={trips}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16, // Adds spacing on sides
          paddingVertical: 16, // Adds vertical padding
          flexGrow: 1, // Allows scrolling
        }}
        style={{ flex: 1 }} // ✅ Allows full width scrolling
        renderItem={({ item }) => (
          <TouchableOpacity
            className="bg-white rounded-2xl shadow-md border border-gray-300 w-300 mx-4 h-[60%] my-40"
            style={{
              width: 300, // Fixed width for each item
              height: "60%", // Relative height
              elevation: 5, // Android shadow
              shadowColor: "#000", // iOS shadow
              shadowOpacity: 0.2,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 3 },
            }}
            onPress={() =>
              router.push({
                pathname: `/trip/${item.id}`,
                params: { tripId: item.id },
              })
            }
          >
            {/* 📌 Image */}
            <Image
              source={{
                uri: item.best_photos
                  ? item.best_photos[0]
                  : "https://www.four-paws.org/our-stories/publications-guides/a-cats-personality",
              }}
              className="w-full h-[50%] rounded-t-2xl"
              style={{ resizeMode: "cover" }}
            />

            {/* 📌 Trip Info */}
            <View className="p-4">
              <Text className="text-lg font-semibold text-gray-900 ">
                {item.name}
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                {moment(item.start_date).format("MMMM DD, YYYY - hh:mm A")}
              </Text>
              <Text className="text-sm text-gray-500 mt-1">
                {moment(item.end_date).format("MMMM DD, YYYY - hh:mm A")}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* 📌 Floating Action Button to Create New Trip */}
      <TouchableOpacity
        className="absolute bottom-20 right-6 bg-orange-500 w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
        onPress={() => {
          setTripModalVisible(true);
        }}
      >
        <FontAwesome name="plus" size={30} color="white" />
      </TouchableOpacity>

      <Modal visible={tripModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/50 backdrop-blur-md">
          <View className="bg-white w-[85%] rounded-2xl p-6 shadow-xl">
            <Text className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Create a New Trip
            </Text>

            {/* Trip Name Input */}
            <Text className="text-lg font-semibold mb-2">Trip Name</Text>
            <TextInput
              className="w-full p-4 bg-gray-100 rounded-xl text-lg border border-gray-300 mb-4"
              placeholder="Enter Trip Name"
              value={newTripName}
              onChangeText={setNewTripName}
            />

            {/* 📌 Start Date Picker */}
            <Text className="text-lg font-semibold mb-2">
              Start Date & Time
            </Text>
            <TouchableOpacity
              className="p-4 bg-gray-100 rounded-xl border border-gray-300 mb-4"
              onPress={() => setShowStartPicker(true)}
            >
              <Text className="text-gray-700 text-lg">
                {moment(startDate).format("MMMM DD, YYYY - hh:mm A")}
              </Text>
            </TouchableOpacity>
            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="datetime" // ✅ Shows both date & time
                display="default"
                onChange={(event, selectedDate) =>
                  handleDateChange(event, selectedDate, true)
                }
              />
            )}

            {/* 📌 End Date Picker */}
            <Text className="text-lg font-semibold mb-2">End Date & Time</Text>
            <TouchableOpacity
              className="p-4 bg-gray-100 rounded-xl border border-gray-300"
              onPress={() => setShowEndPicker(true)}
            >
              <Text className="text-gray-700 text-lg">
                {moment(endDate).format("MMMM DD, YYYY - hh:mm A")}
              </Text>
            </TouchableOpacity>
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="datetime" // ✅ Shows both date & time
                display="default"
                onChange={(event, selectedDate) =>
                  handleDateChange(event, selectedDate, false)
                }
              />
            )}

            {/* Create & Cancel Buttons */}
            <View className="flex-row justify-between mt-6">
              <TouchableOpacity
                className="bg-orange-500 py-3 w-[48%] rounded-xl shadow-lg"
                onPress={handleCreateTrip}
              >
                <Text className="text-white font-bold text-center text-lg">
                  Create
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-gray-300 py-3 w-[48%] rounded-xl"
                onPress={() => setTripModalVisible(false)}
              >
                <Text className="text-gray-800 font-bold text-center text-lg">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
