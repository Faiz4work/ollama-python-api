# from ollama import generate

# # Regular response
# response = generate('qwen2.5:7b', 'Why is the sky blue?')
# print(response['response'])


# from ollama import generate

# for chunk in generate('qwen2.5:7b', 'Why is the sky blue?', stream=True):
#     print(chunk['response'], end='', flush=True)

# print()  # New line at the end

# from ollama import chat

# # Define a system prompt
# system_prompt = "You speaks and sounds like a pirate with short sentences."

# # Chat with a system prompt
# response = chat('qwen2.5:7b', 
#                 messages=[
#                     {'role': 'system', 'content': system_prompt},
#                     {'role': 'user', 'content': 'Tell me about your boat.'}
#                 ])


from ollama import chat

# Initialize an empty message history
messages = []
while True:
    user_input = input('Chat with history: ')
    if user_input.lower() == 'exit':
        break
    # Get streaming response while maintaining conversation history
    response_content = ""
    for chunk in chat(
        'qwen2.5:7b',
        messages=messages + [
            {'role': 'system', 'content': 'You are a helpful assistant. You only give a short sentence by answer.'},
            {'role': 'user', 'content': user_input},
        ],
        stream=True
    ):
        if chunk.message:
            response_chunk = chunk.message.content
            print(response_chunk, end='', flush=True)
            response_content += response_chunk
    # Add the exchange to the conversation history
    messages += [
        {'role': 'user', 'content': user_input},
        {'role': 'assistant', 'content': response_content},
    ]
    print('\n')  # Add space after response

